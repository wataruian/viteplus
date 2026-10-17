import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import MarkdownIt from 'markdown-it';
import ts from 'typescript';
import { getLanguageService as getJsonLanguageService } from 'vscode-json-languageservice';
import { TextDocument, type TextEdit } from 'vscode-languageserver-textdocument';
import {
  type IMdLanguageService,
  type IMdParser,
  type IWorkspace,
  LogLevel,
  createLanguageService as createMarkdownLanguageService,
  githubSlugifier,
} from 'vscode-markdown-languageservice';

import { ignorePatterns } from '../vite.config.ts';
import { removeComments } from './remove-comments.ts';

type CancellationToken = Parameters<IMdLanguageService['organizeLinkDefinitions']>[2];

const rootDir = path.resolve(import.meta.dirname, '..');

const scriptExtensions = new Set(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);
const jsonExtensions = new Set(['.json', '.jsonc']);
const unsortedJsonFiles = new Set(['dagger.json']);
const markdownExtensions = new Set(['.md']);
const commonJsExtensions = new Set(['.cjs', '.cts']);
const storyFilePattern = /\.stories\.[cm]?[jt]sx?$/u;
const testFilePattern = /(?:^|\/)tests\/|\.(?:spec|test)\.[cm]?[jt]sx?$/u;
const mutableCollections = new Set(['Map', 'Set', 'WeakMap', 'WeakSet']);

const indentSize = 2;

const noopEvent = () => ({ dispose: () => undefined });

const resolveUndefined = async (): Promise<undefined> => {
  await Promise.resolve();
  return undefined;
};

const fileExists = (file: string): boolean => ts.sys.fileExists(file);
const readFile = (file: string): string | undefined => ts.sys.readFile(file);

const isIgnored = (file: string): boolean =>
  ignorePatterns.some(
    (pattern) =>
      file === pattern ||
      file.startsWith(`${pattern}/`) ||
      file.includes(`/${pattern}/`) ||
      file.endsWith(`/${pattern}`),
  );

const listFiles = (): string[] =>
  execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: rootDir,
    encoding: 'utf8',
  })
    .split('\0')
    .filter((file) => file !== '' && !isIgnored(file))
    .map((file) => path.resolve(rootDir, file))
    .filter((file) => fs.existsSync(file));

const writeIfChanged = (file: string, original: string, updated: string): boolean => {
  if (updated === original) {
    return false;
  }
  fs.writeFileSync(file, updated);
  return true;
};

const applyTextEdits = (file: string, languageId: string, edits: TextEdit[]): boolean => {
  const original = fs.readFileSync(file, 'utf8');
  const document = TextDocument.create(pathToFileURL(file).href, languageId, 0, original);
  return writeIfChanged(file, original, TextDocument.applyEdits(document, edits));
};

const getCompilerOptions = (configPath: string | undefined): ts.CompilerOptions => {
  if (configPath === undefined) {
    return { ...ts.getDefaultCompilerOptions(), allowJs: true };
  }
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      fileExists,
      getCurrentDirectory: () => rootDir,
      onUnRecoverableConfigFileDiagnostic: () => undefined,
      readDirectory: (...args) => ts.sys.readDirectory(...args),
      readFile,
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    },
  );
  return { ...parsed?.options, allowJs: true };
};

const organizeImports = (files: string[]): string[] => {
  const filesByConfig = new Map<string | undefined, string[]>();
  for (const file of files) {
    const configPath = ts.findConfigFile(path.dirname(file), fileExists);
    filesByConfig.set(configPath, [...(filesByConfig.get(configPath) ?? []), file]);
  }

  const changed: string[] = [];
  for (const [configPath, configFiles] of filesByConfig) {
    const compilerOptions = getCompilerOptions(configPath);
    const service = ts.createLanguageService(
      {
        directoryExists: (directory) => ts.sys.directoryExists(directory),
        fileExists,
        getCompilationSettings: () => compilerOptions,
        getCurrentDirectory: () => rootDir,
        getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
        getDirectories: (directory) => ts.sys.getDirectories(directory),
        getScriptFileNames: () => configFiles,
        getScriptSnapshot: (file) => {
          const text = readFile(file);
          return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
        },
        getScriptVersion: () => '0',
        readDirectory: (...args) => ts.sys.readDirectory(...args),
        readFile,
      },
      ts.createDocumentRegistry(),
    );

    for (const file of configFiles) {
      const textChanges = service
        .organizeImports(
          { fileName: file, mode: ts.OrganizeImportsMode.All, type: 'file' },
          { convertTabsToSpaces: true, indentSize, tabSize: indentSize },
          { organizeImportsCollation: 'ordinal', organizeImportsIgnoreCase: 'auto' },
        )
        .filter((change) => change.fileName === file)
        .flatMap((change) => change.textChanges);

      const original = fs.readFileSync(file, 'utf8');
      const updated = textChanges
        .toSorted((a, b) => b.span.start - a.span.start)
        .reduce(
          (text, { span, newText }) =>
            `${text.slice(0, span.start)}${newText}${text.slice(span.start + span.length)}`,
          original,
        );
      if (writeIfChanged(file, original, updated)) {
        changed.push(file);
      }
    }
    service.dispose();
  }
  return changed;
};

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);

const getBindingNames = (name: ts.BindingName): string[] =>
  ts.isIdentifier(name)
    ? [name.text]
    : name.elements.flatMap((element) =>
        ts.isOmittedExpression(element) ? [] : getBindingNames(element.name),
      );

const skipWrappers = (expression: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(expression) ||
  ts.isAsExpression(expression) ||
  ts.isSatisfiesExpression(expression) ||
  ts.isNonNullExpression(expression)
    ? skipWrappers(expression.expression)
    : expression;

const isMutableCollection = ({ initializer }: ts.VariableDeclaration): boolean => {
  if (initializer === undefined) {
    return false;
  }
  const expression = skipWrappers(initializer);
  return (
    ts.isNewExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    mutableCollections.has(expression.expression.text)
  );
};

const compareOrdinal = (a: string, b: string): number => Number(a > b) - Number(a < b);

type LocalExportList = ts.ExportDeclaration & { exportClause: ts.NamedExports };

const isLocalExportList = (statement: ts.Statement): statement is LocalExportList =>
  ts.isExportDeclaration(statement) &&
  statement.moduleSpecifier === undefined &&
  statement.exportClause !== undefined &&
  ts.isNamedExports(statement.exportClause);

const getExportedNames = (sourceFile: ts.SourceFile): Set<string> =>
  new Set(
    sourceFile.statements.flatMap((statement) => {
      if (isLocalExportList(statement)) {
        return statement.exportClause.elements.map((element) =>
          (element.propertyName ?? element.name).getText(sourceFile),
        );
      }
      return ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)
        ? [statement.expression.text]
        : [];
    }),
  );

const getDeclaredNames = (
  sourceFile: ts.SourceFile,
  statement: ts.Statement,
): { kind: 'type' | 'value'; names: string[] } => {
  if (
    hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
    hasModifier(statement, ts.SyntaxKind.DeclareKeyword)
  ) {
    return { kind: 'value', names: [] };
  }
  if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
    return { kind: 'type', names: [statement.name.text] };
  }
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement)
  ) {
    return { kind: 'value', names: statement.name === undefined ? [] : [statement.name.text] };
  }
  if (
    ts.isVariableStatement(statement) &&
    statement.declarationList.getFirstToken(sourceFile)?.kind === ts.SyntaxKind.ConstKeyword
  ) {
    return {
      kind: 'value',
      names: statement.declarationList.declarations
        .filter((declaration) => !isMutableCollection(declaration))
        .flatMap((declaration) => getBindingNames(declaration.name)),
    };
  }
  return { kind: 'value', names: [] };
};

const getUnexportedNames = (
  sourceFile: ts.SourceFile,
  typesOnly: boolean,
): { types: string[]; values: string[] } => {
  const exported = getExportedNames(sourceFile);
  const declared = sourceFile.statements.map((statement) =>
    getDeclaredNames(sourceFile, statement),
  );
  const unexported = (kind: 'type' | 'value'): string[] => [
    ...new Set(
      declared
        .filter((declaration) => declaration.kind === kind)
        .flatMap(({ names }) => names)
        .filter((name) => !exported.has(name))
        .toSorted(compareOrdinal),
    ),
  ];
  return { types: unexported('type'), values: typesOnly ? [] : unexported('value') };
};

const isDefaultExport = (statement: ts.Statement): boolean =>
  (ts.isExportAssignment(statement) && statement.isExportEquals !== true) ||
  hasModifier(statement, ts.SyntaxKind.DefaultKeyword);

const getStatementText = (sourceFile: ts.SourceFile, statement: ts.Statement): string =>
  sourceFile.text.slice(statement.getFullStart(), statement.getEnd()).trim();

const exportList = (
  sourceFile: ts.SourceFile,
  lists: LocalExportList[],
  names: string[],
  isTypeOnly: boolean,
): string | undefined => {
  const only = lists.at(0);
  if (lists.length <= 1 && names.length === 0) {
    return only === undefined ? undefined : getStatementText(sourceFile, only);
  }
  const comments = lists
    .map((list) => sourceFile.text.slice(list.getFullStart(), list.getStart(sourceFile)).trim())
    .filter((comment) => comment !== '');
  const elements = [
    ...lists.flatMap((list) =>
      list.exportClause.elements.map((element) => ({
        name: element.name.getText(sourceFile),
        text: element.getText(sourceFile),
      })),
    ),
    ...names.map((name) => ({ name, text: name })),
  ].toSorted((a, b) => compareOrdinal(a.name, b.name));
  const keyword = isTypeOnly ? 'export type' : 'export';
  return [...comments, `${keyword} { ${elements.map(({ text }) => text).join(', ')} };`].join('\n');
};

const canMoveToEnd = (statement: ts.Statement, others: ts.Statement[]): boolean =>
  statement === others.at(-1) ||
  (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression));

const removeStatements = (sourceFile: ts.SourceFile, statements: ts.Statement[]): string =>
  statements
    .toSorted((a, b) => b.getFullStart() - a.getFullStart())
    .reduce(
      (text, statement) =>
        `${text.slice(0, statement.getFullStart())}${text.slice(statement.getEnd())}`,
      sourceFile.text,
    );

const splitAroundExports = (
  sourceFile: ts.SourceFile,
  lists: LocalExportList[],
  defaultExport: ts.Statement | undefined,
  others: ts.Statement[],
): [string, string] => {
  if (defaultExport === undefined) {
    return [removeStatements(sourceFile, lists).trim(), ''];
  }
  if (canMoveToEnd(defaultExport, others)) {
    return [
      removeStatements(sourceFile, [...lists, defaultExport]).trim(),
      getStatementText(sourceFile, defaultExport),
    ];
  }
  const position =
    defaultExport.getFullStart() -
    lists
      .filter((list) => list.getEnd() <= defaultExport.getFullStart())
      .reduce((removed, list) => removed + list.getEnd() - list.getFullStart(), 0);
  const body = removeStatements(sourceFile, lists);
  return [body.slice(0, position).trim(), body.slice(position).trim()];
};

const exportAll = (files: string[]): string[] =>
  files.filter((file) => {
    const original = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true);

    if (!ts.isExternalModule(sourceFile)) {
      return false;
    }

    const { types, values } = getUnexportedNames(sourceFile, storyFilePattern.test(file));
    const lists = sourceFile.statements.filter(isLocalExportList);
    const exportLists = [
      exportList(
        sourceFile,
        lists.filter((list) => !list.isTypeOnly),
        values,
        false,
      ),
      exportList(
        sourceFile,
        lists.filter((list) => list.isTypeOnly),
        types,
        true,
      ),
    ]
      .filter((list) => list !== undefined)
      .join('\n');
    if (exportLists === '') {
      return false;
    }

    const others = sourceFile.statements.filter((statement) => !isLocalExportList(statement));
    const defaultExport = others.findLast((statement) => isDefaultExport(statement));
    const [before, after] = splitAroundExports(sourceFile, lists, defaultExport, others);
    const updated = [before, exportLists, after].filter((text) => text !== '').join('\n\n');
    return writeIfChanged(file, original, `${updated}\n`);
  });

const sortJson = (files: string[]): string[] => {
  const service = getJsonLanguageService({});
  return files.filter((file) => {
    const document = TextDocument.create(
      pathToFileURL(file).href,
      'json',
      0,
      fs.readFileSync(file, 'utf8'),
    );
    const edits = service.sort(document, {
      insertFinalNewline: true,
      insertSpaces: true,
      tabSize: indentSize,
    });
    return applyTextEdits(file, 'json', edits);
  });
};

const organizeLinkDefinitions = async (files: string[]): Promise<string[]> => {
  const markdownIt = new MarkdownIt({ html: true });
  const parser: IMdParser = {
    slugifier: githubSlugifier,
    tokenize: async (document) => await Promise.resolve(markdownIt.parse(document.getText(), {})),
  };
  const workspace: IWorkspace = {
    getAllMarkdownDocuments: async () => await Promise.resolve([]),
    hasMarkdownDocument: () => false,
    onDidChangeMarkdownDocument: noopEvent,
    onDidCreateMarkdownDocument: noopEvent,
    onDidDeleteMarkdownDocument: noopEvent,
    openMarkdownDocument: resolveUndefined,
    readDirectory: async () => await Promise.resolve([]),
    stat: resolveUndefined,
    workspaceFolders: [],
  };
  const service = createMarkdownLanguageService({
    logger: { level: LogLevel.Off, log: () => undefined },
    parser,
    workspace,
  });
  const token: CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: noopEvent,
  };

  const results = await Promise.all(
    files.map(async (file) => {
      const document = TextDocument.create(
        pathToFileURL(file).href,
        'markdown',
        0,
        fs.readFileSync(file, 'utf8'),
      );
      const edits = await service.organizeLinkDefinitions(document, { removeUnused: true }, token);
      return applyTextEdits(file, 'markdown', edits) ? [file] : [];
    }),
  );
  service.dispose();
  return results.flat();
};

const hasExtension = (extensions: Set<string>, file: string): boolean =>
  extensions.has(path.extname(file)) && !file.endsWith('.d.ts');

const report = (action: string, changed: string[]): void => {
  process.stdout.write(`✅ ${action}: ${changed.length} file(s) touched\n`);
};

const files = listFiles();

if (process.argv.includes('--remove-comments')) {
  report('source.removeComments', removeComments(rootDir, files));
}

report(
  'source.exportAll',
  exportAll(
    files.filter(
      (file) =>
        hasExtension(scriptExtensions, file) &&
        !hasExtension(commonJsExtensions, file) &&
        !testFilePattern.test(path.relative(rootDir, file)),
    ),
  ),
);

report(
  'source.organizeImports',
  organizeImports(files.filter((file) => hasExtension(scriptExtensions, file))),
);

report(
  'source.sort.json',
  sortJson(
    files.filter(
      (file) =>
        hasExtension(jsonExtensions, file) && !unsortedJsonFiles.has(path.relative(rootDir, file)),
    ),
  ),
);

report(
  'source.organizeLinkDefinitions',
  await organizeLinkDefinitions(files.filter((file) => hasExtension(markdownExtensions, file))),
);

export {
  applyTextEdits,
  canMoveToEnd,
  compareOrdinal,
  exportAll,
  exportList,
  fileExists,
  files,
  getBindingNames,
  getCompilerOptions,
  getDeclaredNames,
  getExportedNames,
  getStatementText,
  getUnexportedNames,
  hasExtension,
  hasModifier,
  indentSize,
  isDefaultExport,
  isIgnored,
  isLocalExportList,
  isMutableCollection,
  listFiles,
  noopEvent,
  organizeImports,
  organizeLinkDefinitions,
  readFile,
  removeStatements,
  report,
  resolveUndefined,
  rootDir,
  skipWrappers,
  sortJson,
  splitAroundExports,
  storyFilePattern,
  testFilePattern,
  writeIfChanged,
};
export type { CancellationToken, LocalExportList };
