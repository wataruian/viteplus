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

type CancellationToken = Parameters<IMdLanguageService['organizeLinkDefinitions']>[2];

const rootDir = path.resolve(import.meta.dirname, '..');

const scriptExtensions = new Set(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);
const jsonExtensions = new Set(['.json', '.jsonc']);
const unsortedJsonFiles = new Set(['dagger.json']);
const markdownExtensions = new Set(['.md']);

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
