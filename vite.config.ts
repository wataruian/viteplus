import fs from 'node:fs';
import path from 'node:path';

import { type UserConfig, defineConfig, loadEnv } from 'vite-plus';

const ignorePatterns = [
  '.templates/plop',
  'node_modules',
  'bak',
  'dist',
  'out',
  'coverage',
  'tmp',
  'vite.config.d.ts',
  'vite.config.d.ts.map',
  'tsconfig.tsbuildinfo',
  'storybook-static',
  '.wrangler',
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

const getEnvArray = (rootDir: string, mode: string) => {
  const dotenvKeys = getDotenvKeys(rootDir);
  const env = loadEnv(mode, rootDir, dotenvKeys.length > 0 ? dotenvKeys : ['VITE_']);
  return Object.keys(env).map((key) => key);
};

const getCommonRunProps = (rootDir: string, mode: string, isPackage = true) => {
  const envArray = getEnvArray(rootDir, mode);

  const commonRootInputs = [
    '.env',
    '.npmrc',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.base.json',
    'tsconfig.json',
    'tsconfig.madge.json',
    'vite.config.ts',
    'commitlint.config.ts',
    'plopfile.ts',
  ];

  const rootInputs = ['**/*.ts', '**/*.tsx'];

  const packageInputs = [
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'uno.config.ts',
    '**/*.html',
    '**/*.css',
    '**/*.svg',
    '**/*.ts',
    '**/*.tsx',
  ];

  const input: (string | { base: 'package' | 'workspace'; pattern: string })[] = isPackage
    ? [
        ...commonRootInputs.map((pattern) => ({ base: 'workspace' as const, pattern })),
        ...packageInputs.map((pattern) => ({ base: 'package' as const, pattern })),
      ]
    : [
        ...commonRootInputs.map((pattern) => ({ base: 'workspace' as const, pattern })),
        ...rootInputs.map((pattern) => ({ base: 'workspace' as const, pattern })),
        ...packageInputs.map((pattern) => ({
          base: 'workspace' as const,
          pattern: `packages/**/*/${pattern}`,
        })),
        ...packageInputs.map((pattern) => ({
          base: 'workspace' as const,
          pattern: `apps/**/*/${pattern}`,
        })),
      ];

  const allInput = [...input, ...ignorePatterns.map((pattern) => `!**/${pattern}/**`)];

  return { env: envArray, input: allInput };
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
  const isDevMode = mode !== 'production';

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
      chunkSizeWarningLimit: 2500,
      cssCodeSplit: !isDevMode,
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
      ignorePatterns,
      insertFinalNewline: true,
      jsxSingleQuote: true,
      quoteProps: 'as-needed',
      semi: true,
      singleQuote: true,
      sortImports: true,
      trailingComma: 'all',
      useTabs: false,
    },
    lint: {
      categories: {
        correctness: 'error',
        nursery: 'error',
        pedantic: 'error',
        perf: 'error',
        restriction: 'error',
        style: 'error',
        suspicious: 'error',
      },
      ignorePatterns,
      jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
      options: { typeAware: true, typeCheck: true },
      rules: {
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
        'no-underscore-dangle': ['error', { allow: ['_def'] }],
        'one-var': 'off',
        'oxc/no-async-await': 'off',
        'oxc/no-optional-chaining': 'off',
        'oxc/no-rest-spread-properties': 'off',
        'sort-imports': ['error', { ignoreDeclarationSort: true }],
        'typescript/explicit-function-return-type': 'off',
        'typescript/explicit-module-boundary-types': 'off',
        'typescript/no-extraneous-class': 'off',
        'typescript/prefer-readonly-parameter-types': 'off',
        'unicorn/max-nested-calls': 'off',
        'unicorn/no-array-reduce': 'off',
        'unicorn/no-null': 'off',
        'unicorn/no-object-as-default-parameter': 'off',
        'unicorn/no-useless-undefined': 'off',
        'vite-plus/prefer-vite-plus-imports': 'error',
      },
    },
    pack: {
      clean: true,
      dts: {
        cjsReexport: true,
        sourcemap: isLocal,
        tsgo: true,
      },
      entry: ['src/**/*.ts', 'src/**/*.tsx', '!src/**/*.stories.ts', '!src/**/*.stories.tsx'],
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
    resolve: {
      conditions: ['typescript'],
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
        thresholds: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
      env: {
        LOG_LEVEL: 'silent',
      },
      environment: 'node',
      fileParallelism: true,
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
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
  buildCommand = '',
  startCommand = 'node dist/index.mjs',
  excludeDevCommand = true,
  excludeStartCommand = true,
}: {
  dir?: string;
  isRoot?: boolean;
  mode?: string;
  buildType?: 'build' | 'pack' | 'custom';
  buildCommand?: string;
  devCommand?: string;
  startCommand?: string;
  excludeDevCommand?: boolean;
  excludeStartCommand?: boolean;
} = {}): UserConfig => {
  let rootDir = dir;

  if (!isRoot) {
    rootDir = path.resolve(dir, '../..');
  }

  if (buildType === 'custom' && (!buildCommand || buildCommand.trim() === '')) {
    throw new Error('buildCommand is required for custom build type');
  }

  let resolvedBuildCommand = `vp ${buildType}`;
  if (buildType === 'custom') {
    resolvedBuildCommand = buildCommand;
  }

  const commonRunProps = getCommonRunProps(rootDir, mode);

  return {
    ...getCommonViteConfig({ dir, isRoot, mode }),
    run: {
      tasks: {
        build: {
          command: resolvedBuildCommand,
          ...commonRunProps,
          output: [
            {
              base: 'package',
              pattern: 'dist/**/*',
            },
            {
              base: 'package',
              pattern: 'out/**/*',
            },
            {
              base: 'package',
              pattern: 'storybook-static/**/*',
            },
          ],
        },
        check: {
          command: 'vp check',
          ...commonRunProps,
        },
        format: {
          command: 'vp format',
          ...commonRunProps,
        },
        lint: {
          command: 'vp lint',
          ...commonRunProps,
        },
        test: {
          command: 'vp test',
          ...commonRunProps,
          output: [
            {
              base: 'package',
              pattern: 'coverage/**/*',
            },
          ],
        },
        'type-check': {
          command: 'tsc',
          ...commonRunProps,
          output: [
            {
              base: 'package',
              pattern: 'tsconfig.tsbuildinfo',
            },
          ],
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

const getRootViteConfig = (): UserConfig => {
  const dir = import.meta.dirname;
  const isRoot = true;
  const mode = globalThis.process.env['NODE_ENV'] ?? 'development';

  const commonRunProps = getCommonRunProps(dir, mode, false);

  return {
    ...getCommonViteConfig({
      dir,
      isRoot,
      mode,
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
      tasks: {
        commit: {
          cache: false,
          command: 'cz',
        },
        madge: {
          command:
            "madge --circular --warning --exclude '(dist|out|storybook-static|.wrangler|coverage|tmp)' --ts-config ./tsconfig.madge.json --extensions ts,tsx packages apps",
          ...commonRunProps,
        },
        plop: {
          cache: false,
          command: 'plop',
        },
        root: {
          command: 'vp check',
          ...commonRunProps,
        },
      },
    },
    staged: {
      '*': 'vp check --fix',
    },
  };
};

export {
  getCommonRunProps,
  getCommonViteConfig,
  getDotenvKeys,
  getEnvArray,
  getPackageViteConfig,
  getRootViteConfig,
  ignorePatterns,
};

export default defineConfig(getRootViteConfig());
