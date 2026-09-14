import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const isWordChar = (char: string | undefined): boolean =>
  char !== undefined && /[A-Za-z0-9_]/u.test(char);

const isWhitespaceChar = (char: string | undefined): boolean =>
  char !== undefined && /\s/u.test(char);

const skipWhile = (
  text: string,
  from: number,
  matches: (char: string | undefined) => boolean,
): number => {
  let index = from;
  while (matches(text[index])) {
    index += 1;
  }
  return index;
};

const extractArgTypeBlocks = (blocksText: string): { body: string; name: string }[] => {
  const entries: { body: string; name: string }[] = [];
  let index = 0;

  while (index < blocksText.length) {
    if (!isWordChar(blocksText[index])) {
      index += 1;
      continue;
    }

    const nameStart = index;
    const nameEnd = skipWhile(blocksText, index, isWordChar);
    const name = blocksText.slice(nameStart, nameEnd);

    const colonIndex = skipWhile(blocksText, nameEnd, isWhitespaceChar);
    if (blocksText[colonIndex] !== ':') {
      index = nameEnd;
      continue;
    }

    const braceStart = skipWhile(blocksText, colonIndex + 1, isWhitespaceChar);
    if (blocksText[braceStart] !== '{') {
      index = nameEnd;
      continue;
    }

    let depth = 0;
    let braceEnd = -1;

    for (let i = braceStart; i < blocksText.length; i += 1) {
      if (blocksText[i] === '{') {
        depth += 1;
      } else if (blocksText[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          braceEnd = i;
          break;
        }
      }
    }

    if (braceEnd === -1) {
      break;
    }

    entries.push({ body: blocksText.slice(braceStart, braceEnd + 1), name });
    index = braceEnd + 1;
  }

  return entries;
};

const getVariants = (content: string): Record<string, string[]> => {
  const m = /argTypes:\s*\{(?<blocks>[\s\S]*?)\}[\s,]*(?:component|tags|title):/u.exec(content);
  const variants: Record<string, string[]> = {};
  if (m?.groups?.['blocks'] !== undefined && m.groups['blocks'] !== '') {
    for (const { body, name } of extractArgTypeBlocks(m.groups['blocks'])) {
      if (name === 'as') {
        continue;
      }

      const optMatch = /options:\s*\[(?<options>[^\]]+)\]/u.exec(body);

      if (optMatch?.groups?.['options'] !== undefined && optMatch.groups['options'] !== '') {
        const opts = optMatch.groups['options']
          .split(',')
          .map((s) => s.trim().replaceAll(/^['"]|['"]$/gu, ''))
          .filter(Boolean);
        variants[name] = opts;
      }
    }
  }
  return variants;
};

const RESERVED_GLOBAL_NAMES = new Set([
  'Array',
  'ArrayBuffer',
  'Boolean',
  'Date',
  'Error',
  'Function',
  'Infinity',
  'JSON',
  'Map',
  'Math',
  'NaN',
  'Number',
  'Object',
  'Promise',
  'Proxy',
  'Reflect',
  'RegExp',
  'Set',
  'String',
  'Symbol',
  'WeakMap',
  'WeakSet',
  'undefined',
]);

const sanitizeStoryName = (option: string): string => {
  let safeOption = option;

  if (safeOption === 'true') {
    safeOption = 'True';
  }

  if (safeOption === 'false') {
    safeOption = 'False';
  }

  safeOption = safeOption.replaceAll(/\W/gu, '');

  if (safeOption.length === 0) {
    return '';
  }

  const storyName = safeOption.charAt(0).toUpperCase() + safeOption.slice(1);

  return RESERVED_GLOBAL_NAMES.has(storyName) ? `${storyName}State` : storyName;
};

const generateVariantStories = (
  variantNames: string[],
  variants: Record<string, string[]>,
  content: string,
): { exportList: string[]; generatedStories: string } => {
  const exportList: string[] = ['Default'];
  let generatedStories = '';

  for (const variantName of variantNames) {
    for (const option of variants[variantName]) {
      const storyName = sanitizeStoryName(option);

      if (storyName === '' || storyName === 'Default') {
        continue;
      }

      exportList.push(storyName);

      if (!content.includes(`const ${storyName}: StoryObj`)) {
        const value = option === 'true' || option === 'false' ? option : `'${option}'`;

        generatedStories += `\nconst ${storyName}: StoryObj<typeof meta> = {
  args: {
    ...Default.args,
    ${variantName}: ${value},
  },
};\n`;
      }
    }
  }

  return { exportList, generatedStories };
};

const mergeExports = (content: string, exportList: string[]): string => {
  const reservedNames = new Set(['AllVariants', 'Intent', 'Size', 'Look', 'Variant', 'State']);

  return content.replace(/export\s+\{(?<exports>[^}]+)\};/u, (_match: string, group1: string) => {
    const existingExports = group1
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s !== '' && !reservedNames.has(s));

    const finalExports: string[] = [];
    const allExports = new Set([...existingExports, ...exportList]);

    for (const exp of allExports) {
      if (!finalExports.some((f) => f.endsWith(` as ${exp}`) || f === exp)) {
        finalExports.push(exp);
      }
    }

    return `export { ${finalExports.join(', ')} };`;
  });
};

const updateStoryFile = (storiesFile: string): boolean => {
  let content = fs.readFileSync(storiesFile, 'utf8');

  const variants = getVariants(content);
  const variantNames = Object.keys(variants);
  if (variantNames.length === 0) {
    return false;
  }

  let changed = false;

  if (content.includes('const AllVariants')) {
    content = content.replace(/const AllVariants[\s\S]*?\n\};\n\n/u, '');
    changed = true;
  }

  content = content.replaceAll(
    /const (?:Intent|Size|Look|Variant|State|Label|Radius|Align|Color|Type|Tone): StoryObj<typeof meta> = \{[\s\S]*?\n\};\n/gu,
    '',
  );

  const { exportList, generatedStories } = generateVariantStories(variantNames, variants, content);

  if (generatedStories !== '') {
    changed = true;
  }

  if (!changed) {
    return false;
  }

  content = content.replace(/(?<export>\nexport\s+\{)/u, `${generatedStories}$<export>`);
  content = mergeExports(content, exportList);

  fs.writeFileSync(storiesFile, content);
  return true;
};

const updateStories = () => {
  const dir = path.join(globalThis.process.cwd(), 'src', 'components');

  const filesToFix: string[] = [];
  const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.stories.tsx'));

  for (const file of files) {
    const storiesFile = path.join(dir, file);
    const updated = updateStoryFile(storiesFile);
    if (updated) {
      filesToFix.push(storiesFile);
    }
  }

  if (filesToFix.length > 0) {
    globalThis.process.stdout.write(`Running vp check --fix on ${filesToFix.length} files...\n`);

    const vpBin = path.join(globalThis.process.cwd(), 'node_modules', '.bin', 'vp');

    execFile(
      vpBin,
      ['check', '--fix', ...filesToFix],
      (err: Error | null, stdout: string, stderr: string) => {
        if (stdout !== '') {
          globalThis.process.stdout.write(stdout);
        }
        if (stderr !== '') {
          globalThis.process.stderr.write(stderr);
        }
        if (err === null) {
          globalThis.process.stdout.write('Successfully updated and formatted story files.\n');
        } else {
          throw new Error(`Linting failed: ${err.message}`);
        }
      },
    );
  } else {
    globalThis.process.stdout.write('All story files are up to date.\n');
  }
};

if (import.meta.url === `file://${globalThis.process.argv[1]}`) {
  globalThis.console.log('🚀 Updating stories...');
  updateStories();
  globalThis.console.log('✅ Done updating stories');
}

export {
  extractArgTypeBlocks,
  generateVariantStories,
  getVariants,
  mergeExports,
  sanitizeStoryName,
  updateStories,
  updateStoryFile,
};
