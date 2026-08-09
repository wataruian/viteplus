import { type UserConfig, defineConfig, loadEnv } from 'vite-plus';
import fs from 'node:fs';
import path from 'node:path';

const commonIgnorePatterns = [
  ...new Set([
    '*.tsbuildinfo',
    '__unconfig_vite.config.ts',
    '.agents',
    '.ai-data',
    '.aiassistant',
    '.antigravity',
    '.claude',
    '.cursor',
    '.git',
    '.github',
    '.gitignore',
    '.vite-hooks',
    '.vscode',
    '.templates',
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    'README.md',
    'bak',
    'check.sh',
    'clean.sh',
    'coverage',
    'dist',
    'dist-ssr',
    'init.sh',
    'node_modules',
    'prompt.txt',
    'root.txt',
    'start.sh',
    'tmp',
    'tsconfig.reference.json',
    'vite.config.d.ts',
    'vite.config.d.ts.map',
  ]),
];

const commonRunInputs = [
  ...new Set([
    '**',
    { base: 'workspace' as const, pattern: '.env' },
    { base: 'workspace' as const, pattern: '.env.example' },
    { base: 'workspace' as const, pattern: '.envrc' },
    { base: 'workspace' as const, pattern: '.npmrc' },
    { base: 'workspace' as const, pattern: '.tool-versions' },
    { base: 'workspace' as const, pattern: 'package.json' },
    { base: 'workspace' as const, pattern: 'pnpm-lock.yaml' },
    { base: 'workspace' as const, pattern: 'pnpm-workspace.yaml' },
    { base: 'workspace' as const, pattern: 'tsconfig.base.json' },
    { base: 'workspace' as const, pattern: 'tsconfig.json' },
    { base: 'workspace' as const, pattern: 'vite.config.ts' },
    ...commonIgnorePatterns.flatMap((pattern) => {
      const isGlob = pattern.includes('*');
      const hasRelativePrefix = pattern.startsWith('**/');
      const results = [`!${pattern}`];
      if (!hasRelativePrefix) {
        results.push(`!**/${pattern}`);
      }
      if (!isGlob) {
        results.push(`!${pattern}/**`);
        if (!hasRelativePrefix) {
          results.push(`!**/${pattern}/**`);
        }
      }
      return results;
    }),
  ]),
];

const getDotenvKeys = (rootDir: string): string[] => {
  const filePath = path.resolve(rootDir, '.env');
  const keys = new Set<string>();
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = /^(?<key>[^=]+)=/u.exec(trimmed);
          if (match) {
            keys.add(match[1].trim());
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  return [...keys];
};

const getCommonViteConfig = ({
  dir = import.meta.dirname,
  isRoot = false,
  mode = 'development',
}: {
  dir?: string;
  isRoot?: boolean;
  mode?: string;
} = {}): UserConfig => {
  let rootDir = dir;

  if (!isRoot) {
    rootDir = path.resolve(dir, '../..');
  }

  const dotenvKeys = getDotenvKeys(rootDir);
  const env = loadEnv(mode, rootDir, dotenvKeys.length > 0 ? dotenvKeys : ['VITE_']);
  const isLocal = env['ENV'] === 'local';

  const pkgPath = path.resolve(dir, 'package.json');
  let pkgName: string | undefined = undefined;
  try {
    const pkg: unknown = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg !== null && typeof pkg === 'object' && 'name' in pkg) {
      const { name } = pkg;
      if (typeof name === 'string') {
        pkgName = name;
      }
    }
  } catch {
    // Ignore error if package.json does not exist or is invalid
  }

  return {
    build: {
      cssCodeSplit: !isLocal,
      cssMinify: !isLocal,
      emptyOutDir: true,
      minify: !isLocal,
      outDir: 'dist',
      sourcemap: isLocal,
    },
    fmt: {
      arrowParens: 'always',
      bracketSameLine: false,
      bracketSpacing: true,
      endOfLine: 'lf',
      ignorePatterns: commonIgnorePatterns,
      insertFinalNewline: true,
      jsxSingleQuote: true,
      quoteProps: 'as-needed',
      semi: true,
      singleQuote: true,
      trailingComma: 'all',
      useTabs: false,
    },
    lint: {
      // jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
      categories: {
        correctness: 'error',
        nursery: 'error',
        pedantic: 'error',
        perf: 'error',
        restriction: 'error',
        style: 'error',
        suspicious: 'error',
      },
      ignorePatterns: commonIgnorePatterns,
      options: { typeAware: true, typeCheck: true },
      rules: {
        // 'vite-plus/prefer-vite-plus-imports': 'error',
        'capitalized-comments': 'off',
        'id-length': 'off',
        'max-classes-per-file': 'off',
        'max-depth': 'off',
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        'max-params': 'off',
        'max-statements': 'off',
        'new-cap': 'off',
        'no-continue': 'off',
        'no-control-regex': 'off',
        'no-empty-function': 'off',
        'no-eq-null': 'off',
        'no-inline-comments': 'off',
        'no-magic-numbers': 'off',
        'no-ternary': 'off',
        'no-undefined': 'off',
        'oxc/no-async-await': 'off',
        'oxc/no-optional-chaining': 'off',
        'oxc/no-rest-spread-properties': 'off',
        'typescript/explicit-function-return-type': 'off',
        'typescript/explicit-module-boundary-types': 'off',
        'typescript/prefer-readonly-parameter-types': 'off',
        'unicorn/max-nested-calls': 'off',
        'unicorn/no-array-reduce': 'off',
        'unicorn/no-null': 'off',
        'unicorn/no-object-as-default-parameter': 'off',
        'unicorn/no-useless-undefined': 'off',
      },
    },
    pack: {
      clean: true,
      dts: {
        cjsReexport: true,
        sourcemap: isLocal,
        tsgo: true,
      },
      entry: ['src/**/*.ts', 'src/**/*.tsx'],
      exports: false,
      format: ['esm', 'cjs'],
      minify: !isLocal,
      name: pkgName ?? '',
      outDir: 'dist',
      shims: true,
      sourcemap: isLocal,
      treeshake: true,
      unbundle: isLocal,
    },
    test: {
      coverage: {
        clean: true,
        cleanOnRerun: true,
        enabled: true,
        include: ['src/**/*.ts', 'src/**/*.tsx'],
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        reportsDirectory: 'coverage',
      },
      env: {
        LOG_LEVEL: 'silent',
      },
      fileParallelism: false,
      include: ['tests/**/*.test.ts'],
      isolate: false,
      pool: 'forks',
      testTimeout: 30_000,
      // testTimeout: 60 * 60 * 1000, // 1 hour
    },
  };
};

const getPackageViteConfig = ({
  dir = import.meta.dirname,
  mode = 'development',
  isRoot = false,
  buildType = 'pack',
  devCommand = 'tsx watch --conditions=typescript src/index.ts',
  startCommand = 'node dist/index.mjs',
  excludeDevCommand = true,
  excludeStartCommand = true,
}: {
  dir?: string;
  isRoot?: boolean;
  mode?: string;
  buildType?: 'build' | 'pack';
  devCommand?: string;
  startCommand?: string;
  excludeDevCommand?: boolean;
  excludeStartCommand?: boolean;
} = {}): UserConfig => {
  let rootDir = dir;

  if (!isRoot) {
    rootDir = path.resolve(dir, '../..');
  }

  const dotenvKeys = getDotenvKeys(rootDir);
  const env = loadEnv(mode, rootDir, dotenvKeys.length > 0 ? dotenvKeys : ['VITE_']);
  const envArray = Object.keys(env).map((key) => key);
  const commonProps = { env: envArray, input: commonRunInputs };

  return {
    ...getCommonViteConfig({ dir, isRoot, mode }),
    run: {
      tasks: {
        build: {
          command: `vp ${buildType}`,
          ...commonProps,
        },
        check: {
          command: 'vp check',
          ...commonProps,
        },
        format: {
          command: 'vp fmt',
          ...commonProps,
        },
        lint: {
          command: 'vp lint',
          ...commonProps,
        },
        test: {
          command: 'vp test',
          ...commonProps,
        },
        'type-check': {
          command: 'tsc',
          ...commonProps,
        },
        ...(!excludeDevCommand && devCommand
          ? {
              dev: {
                cache: false,
                command: devCommand,
              },
            }
          : {}),
        ...(!excludeStartCommand && startCommand
          ? {
              start: {
                cache: false,
                command: startCommand,
              },
            }
          : {}),
      },
    },
  };
};

const getRootViteConfig = (): UserConfig => ({
  ...getCommonViteConfig({
    dir: import.meta.dirname,
    isRoot: true,
    mode: globalThis.process.env['NODE_ENV'] ?? 'development',
  }),
  create: {
    templates: [
      {
        description: 'New backend application',
        name: 'backend',
        template: './.templates/backend',
      },
      {
        description: 'New frontend application',
        name: 'frontend',
        template: './.templates/frontend',
      },
      {
        description: 'New shared package or library',
        name: 'library',
        template: './.templates/library',
      },
    ],
  },
  run: {
    cache: {
      scripts: true,
      tasks: true,
    },
  },
  staged: {
    '*': 'vp check --fix',
  },
});

export {
  getDotenvKeys,
  commonIgnorePatterns,
  commonRunInputs,
  getCommonViteConfig,
  getPackageViteConfig,
  getRootViteConfig,
};

export default defineConfig(getRootViteConfig());
