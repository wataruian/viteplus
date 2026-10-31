import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

interface CommentRange {
  start: number;
  end: number;
}

type FindComments = (file: string, text: string) => CommentRange[];

const scriptExtensions = new Set(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);
const jsonExtensions = new Set(['.json', '.jsonc']);
const yamlExtensions = new Set(['.yaml', '.yml']);
const markupExtensions = new Set(['.html', '.svg', '.xml']);
const shellDirectories = ['.mise/tasks/', '.vite-hooks/'];
const hashLineFiles = new Set([
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  '.npmrc',
  'CODEOWNERS',
]);
const excludedFiles = new Set([
  '.env',
  '.env.example',
  '.github/workflows/scan.yml',
  '.gitignore',
  '.vscode/extensions.json',
  '.vscode/settings.json',
  'install.sh',
  'mise.toml',
  'tsconfig.reference.json',
]);

const keptPattern = /NOSONAR|NO_SONAR/u;
const scriptDirectivePattern =
  /^\/\/\/\s*<|@vitest-environment|@vite-ignore|[#@]__PURE__|@jsx(?:ImportSource|Runtime|Frag)?\b/u;
const shellDirectivePattern = /^#(?:!|MISE\b|USAGE\b)/u;
const pinnedActionPattern = /uses:\s*\S+@[\da-f]{40}\s*$/u;
const blockScalarPattern = /:\s*[|>][-+\d]*\s*$/u;
const heredocPattern = /^<<-?\s*(?<quote>['"]?)(?<delimiter>[A-Za-z_]\w*)\k<quote>/u;
const shellWordBoundary = /[\s;&|()]/u;

const isLineSpace = (char: string | undefined): boolean => char === ' ' || char === '\t';

const isSpace = (char: string | undefined): boolean => char !== undefined && /\s/u.test(char);

const lineEnd = (text: string, from: number): number => {
  const end = text.indexOf('\n', from);
  return end === -1 ? text.length : end;
};

const findScriptComments: FindComments = (file, text) => {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const ranges = new Map<number, number>();
  const jsxTexts: CommentRange[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      jsxTexts.push({ end: node.getEnd(), start: node.getFullStart() });
    } else {
      for (const range of [
        ...(ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []),
        ...(ts.getTrailingCommentRanges(text, node.getEnd()) ?? []),
      ]) {
        ranges.set(range.pos, range.end);
      }
    }
    for (const child of node.getChildren(sourceFile)) {
      visit(child);
    }
  };
  visit(sourceFile);
  return [...ranges]
    .map(([start, end]) => ({ end, start }))
    .filter(
      ({ start, end }) =>
        !jsxTexts.some((jsxText) => start >= jsxText.start && start < jsxText.end) &&
        !scriptDirectivePattern.test(text.slice(start, end)),
    );
};

const skipQuoted = (text: string, from: number, quote: string, escapes: boolean): number => {
  let index = from + quote.length;
  while (index < text.length && !text.startsWith(quote, index)) {
    index += escapes && text[index] === '\\' ? 2 : 1;
  }
  return index + quote.length;
};

const findSlashComments = (text: string, lineComments: boolean): CommentRange[] => {
  const ranges: CommentRange[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === '"' || char === "'") {
      index = skipQuoted(text, index, char, true);
    } else if (text.startsWith('/*', index)) {
      const close = text.indexOf('*/', index + 2);
      const end = close === -1 ? text.length : close + 2;
      ranges.push({ end, start: index });
      index = end;
    } else if (lineComments && text.startsWith('//', index)) {
      const end = lineEnd(text, index);
      ranges.push({ end, start: index });
      index = end;
    } else {
      index += 1;
    }
  }
  return ranges;
};

const skipHeredocs = (text: string, from: number, delimiters: string[]): number => {
  let index = from;
  for (const delimiter of delimiters) {
    while (index < text.length) {
      const end = lineEnd(text, index);
      const line = text.slice(index, end).trim();
      index = end + 1;
      if (line === delimiter) {
        break;
      }
    }
  }
  return index;
};

const findShellComments: FindComments = (_file, text) => {
  const ranges: CommentRange[] = [];
  const heredocs: string[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const heredoc = char === '<' ? heredocPattern.exec(text.slice(index)) : null;
    if (char === '\\') {
      index += 2;
    } else if (char === "'") {
      index = skipQuoted(text, index, "'", false);
    } else if (char === '"') {
      index = skipQuoted(text, index, '"', true);
    } else if (heredoc?.groups !== undefined && !text.startsWith('<<<', index)) {
      heredocs.push(heredoc.groups['delimiter'] ?? '');
      index += heredoc[0].length;
    } else if (char === '\n') {
      index = skipHeredocs(text, index + 1, heredocs.splice(0));
    } else if (char === '#' && (index === 0 || shellWordBoundary.test(text[index - 1] ?? ''))) {
      const end = lineEnd(text, index);
      if (!shellDirectivePattern.test(text.slice(index, end))) {
        ranges.push({ end, start: index });
      }
      index = end;
    } else {
      index += 1;
    }
  }
  return ranges;
};

const findHashComment = (line: string, wordStartOnly: boolean): number | undefined => {
  let index = 0;
  while (index < line.length) {
    const char = line[index];
    if (char === '"' || char === "'") {
      index = skipQuoted(line, index, char, char === '"');
    } else if (char === '#' && (!wordStartOnly || index === 0 || isLineSpace(line[index - 1]))) {
      return index;
    } else {
      index += 1;
    }
  }
  return undefined;
};

const indentOf = (line: string): number => line.length - line.trimStart().length;

const findYamlComments: FindComments = (_file, text) => {
  const ranges: CommentRange[] = [];
  let offset = 0;
  let scalarIndent: number | undefined = undefined;
  for (const line of text.split('\n')) {
    const lineOffset = offset;
    offset += line.length + 1;
    if (scalarIndent !== undefined && (line.trim() === '' || indentOf(line) > scalarIndent)) {
      continue;
    }
    scalarIndent = undefined;
    const hash = findHashComment(line, true);
    const content = hash === undefined ? line : line.slice(0, hash);
    if (blockScalarPattern.test(content)) {
      scalarIndent = indentOf(line);
    }
    if (hash !== undefined && !pinnedActionPattern.test(content) && line[hash + 1] !== ':') {
      ranges.push({ end: lineOffset + line.length, start: lineOffset + hash });
    }
  }
  return ranges;
};

const tomlQuotes = ['"""', "'''", '"', "'"];

const tomlQuoteAt = (text: string, index: number): string | undefined =>
  tomlQuotes.find((candidate) => text.startsWith(candidate, index));

const findTomlComments: FindComments = (_file, text) => {
  const ranges: CommentRange[] = [];
  let index = 0;
  while (index < text.length) {
    const quote = tomlQuoteAt(text, index);
    if (quote !== undefined) {
      index = skipQuoted(text, index, quote, quote.startsWith('"'));
    } else if (text[index] === '#') {
      const end = lineEnd(text, index);
      if (text[index + 1] !== ':') {
        ranges.push({ end, start: index });
      }
      index = end;
    } else {
      index += 1;
    }
  }
  return ranges;
};

const findHashLineComments: FindComments = (_file, text) => {
  const ranges: CommentRange[] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('#')) {
      ranges.push({ end: offset + line.length, start: offset + indentOf(line) });
    }
    offset += line.length + 1;
  }
  return ranges;
};

const findMarkupComments: FindComments = (_file, text) =>
  [...text.matchAll(/<!--[\s\S]*?-->/gu)].map((match) => ({
    end: match.index + match[0].length,
    start: match.index,
  }));

const isShellScript = (file: string, relative: string, text: string): boolean =>
  file.endsWith('.sh') ||
  shellDirectories.some((directory) => relative.startsWith(directory)) ||
  /^#!.*\b(?:ba|z)?sh\b/u.test(text);

const getCommentFinder = (
  file: string,
  relative: string,
  text: string,
): FindComments | undefined => {
  const extension = path.extname(file);
  const name = path.basename(file);
  if (excludedFiles.has(relative)) {
    return undefined;
  }
  if (scriptExtensions.has(extension)) {
    return findScriptComments;
  }
  if (jsonExtensions.has(extension)) {
    return (_file, content) => findSlashComments(content, true);
  }
  if (extension === '.css') {
    return (_file, content) => findSlashComments(content, false);
  }
  if (yamlExtensions.has(extension)) {
    return findYamlComments;
  }
  if (extension === '.toml') {
    return findTomlComments;
  }
  if (markupExtensions.has(extension)) {
    return findMarkupComments;
  }
  if (hashLineFiles.has(name) || extension === '.properties' || extension === '.conf') {
    return findHashLineComments;
  }
  return isShellScript(file, relative, text) ? findShellComments : undefined;
};

const isInsideEmptyBraces = (
  text: string,
  range: CommentRange,
  ranges: CommentRange[],
): boolean => {
  const byEnd = new Map(ranges.map((item) => [item.end, item]));
  const byStart = new Map(ranges.map((item) => [item.start, item]));
  let before = range.start - 1;
  while (before >= 0) {
    const previous = byEnd.get(before + 1);
    if (previous !== undefined) {
      before = previous.start - 1;
    } else if (isSpace(text[before])) {
      before -= 1;
    } else {
      break;
    }
  }
  let after = range.end;
  while (after < text.length) {
    const next = byStart.get(after);
    if (next !== undefined) {
      after = next.end;
    } else if (isSpace(text[after])) {
      after += 1;
    } else {
      break;
    }
  }
  return text[before] === '{' && text[after] === '}';
};

const removeRange = (text: string, range: CommentRange): string => {
  let { start, end } = range;
  while (isLineSpace(text[start - 1])) {
    start -= 1;
  }
  while (isLineSpace(text[end])) {
    end += 1;
  }
  const startsLine = start === 0 || text[start - 1] === '\n';
  const endsLine = end === text.length || text[end] === '\n';
  if (startsLine && !endsLine) {
    return `${text.slice(0, range.start)}${text.slice(end)}`;
  }
  if (!startsLine) {
    return `${text.slice(0, start)}${endsLine ? '' : ' '}${text.slice(end)}`;
  }
  end = Math.min(text.length, end + 1);
  const previousBlank = start === 0 || text[start - 2] === '\n';
  if (previousBlank && (end === text.length || text[end] === '\n')) {
    if (end < text.length) {
      end += 1;
    } else if (start > 0) {
      start -= 1;
    }
  }
  return `${text.slice(0, start)}${text.slice(end)}`;
};

const removeComments = (rootDir: string, files: string[]): string[] =>
  files.filter((file) => {
    const original = fs.readFileSync(file, 'utf8');
    const relative = path.relative(rootDir, file);
    const findComments = getCommentFinder(file, relative, original);
    if (findComments === undefined) {
      return false;
    }
    const ranges = findComments(file, original);
    const updated = ranges
      .filter(
        (range) =>
          !keptPattern.test(original.slice(range.start, range.end)) &&
          !isInsideEmptyBraces(original, range, ranges),
      )
      .toSorted((a, b) => b.start - a.start)
      .reduce((text, range) => removeRange(text, range), original);
    if (updated === original) {
      return false;
    }
    fs.writeFileSync(file, updated);
    return true;
  });

export {
  blockScalarPattern,
  findHashComment,
  findHashLineComments,
  findMarkupComments,
  findScriptComments,
  findShellComments,
  findSlashComments,
  findTomlComments,
  findYamlComments,
  getCommentFinder,
  heredocPattern,
  indentOf,
  isInsideEmptyBraces,
  isLineSpace,
  isShellScript,
  isSpace,
  keptPattern,
  lineEnd,
  pinnedActionPattern,
  removeComments,
  removeRange,
  scriptDirectivePattern,
  shellDirectivePattern,
  shellDirectories,
  shellWordBoundary,
  skipHeredocs,
  skipQuoted,
  tomlQuoteAt,
  tomlQuotes,
};
export type { CommentRange, FindComments };
