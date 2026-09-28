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
  'dagger/sdk',
  '.pruned',
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

const artifactExclusions = [...ignorePatterns, '.git'].map((pattern) => `!**/${pattern}/**`);

type RunTasks = NonNullable<NonNullable<UserConfig['run']>['tasks']>;
type TaskCache = Extract<RunTasks[string], { command: unknown }>['cache'];
type TaskCacheConfig = Exclude<TaskCache, boolean | undefined>;
interface CommonTaskProps {
  cache: TaskCacheConfig;
}

const getTaskCache = (
  rootDir: string,
  mode: string,
  scope: 'package' | 'workspace' = 'package',
): TaskCacheConfig => {
  const env = getEnvArray(rootDir, mode);
  const input =
    scope === 'package'
      ? [
          { auto: true } as const,
          '**',
          ...ignorePatterns.flatMap((pattern) => [`!${pattern}`, `!**/${pattern}`]),
          ...artifactExclusions,
          '!.',
          '!../*',
        ]
      : [{ auto: true } as const, '**', ...artifactExclusions, '!apps/*', '!packages/*', '!dagger'];
  return { env, input };
};

const getCommonTaskProps = (
  rootDir: string,
  mode: string,
  scope: 'package' | 'workspace' = 'package',
): CommonTaskProps => ({ cache: getTaskCache(rootDir, mode, scope) });

const getCommonViteConfig = ({
  dir = import.meta.dirname,
  mode = 'development',
  pathToRoot = '../..',
}: {
  dir?: string;
  mode?: string;
  pathToRoot?: string;
} = {}): UserConfig => {
  const rootDir = path.resolve(dir, pathToRoot);

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
      chunkSizeWarningLimit: 2500,
      cssCodeSplit: true,
      cssMinify: !isLocal,
      emptyOutDir: true,
      minify: !isLocal,
      outDir: 'dist',
      sourcemap: isLocal,
    },
    pack: {
      clean: true,
      dts: {
        generator: 'tsgo',
        sourcemap: isLocal,
        tsconfig: 'tsconfig.pack.json',
      },
      entry: ['src/**/*.ts', 'src/**/*.tsx', '!src/**/*.stories.ts', '!src/**/*.stories.tsx'],
      exports: false,
      format: ['esm', 'cjs'],
      minify: !isLocal,
      name: pkgName ?? '',
      outDir: 'dist',
      shims: false,
      sourcemap: isLocal,
      treeshake: true,
      unbundle: isLocal,
    },
    resolve: {
      conditions: ['typescript'],
    },
    test: {
      bail: 1,
      coverage: {
        clean: true,
        cleanOnRerun: true,
        enabled: true,
        include: ['src/**/*.ts', 'src/**/*.tsx'],
        provider: 'v8',
        reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
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
      include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
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
  buildType = 'pack',
  devCommand = 'tsx watch --conditions=typescript src/index.ts',
  buildCommand = '',
  startCommand = 'node dist/index.mjs',
  excludeDevCommand = true,
  excludeStartCommand = true,
}: {
  dir?: string;
  mode?: string;
  buildType?: 'build' | 'pack' | 'custom';
  buildCommand?: string;
  devCommand?: string;
  startCommand?: string;
  excludeDevCommand?: boolean;
  excludeStartCommand?: boolean;
} = {}): UserConfig => {
  const rootDir = path.resolve(dir, '../..');

  if (buildType === 'custom' && (!buildCommand || buildCommand.trim() === '')) {
    throw new Error('buildCommand is required for custom build type');
  }

  let resolvedBuildCommand = `vp ${buildType}`;
  if (buildType === 'custom') {
    resolvedBuildCommand = buildCommand;
  }

  const commonTaskProps = getCommonTaskProps(rootDir, mode);

  return {
    ...getCommonViteConfig({ dir, mode }),
    run: {
      tasks: {
        build: {
          cache: {
            ...commonTaskProps.cache,
            output: [
              {
                base: 'package',
                pattern: 'tmp/compile/**/*',
              },
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
          command: resolvedBuildCommand,
        },
        check: {
          ...commonTaskProps,
          command: 'vp check',
        },
        format: {
          ...commonTaskProps,
          command: 'vp format',
        },
        lint: {
          ...commonTaskProps,
          command: 'vp lint',
        },
        test: {
          cache: {
            ...commonTaskProps.cache,
            output: [
              {
                base: 'package',
                pattern: 'coverage/**/*',
              },
            ],
          },
          command: 'vp test',
        },
        'type-check': {
          cache: {
            ...commonTaskProps.cache,
            output: [
              {
                base: 'package',
                pattern: 'tsconfig.tsbuildinfo',
              },
            ],
          },
          command: 'tsc',
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
  const mode = globalThis.process.env['NODE_ENV'] ?? 'development';

  const commonTaskProps = getCommonTaskProps(dir, mode, 'workspace');

  return {
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
        'typescript/return-await': 'off',
        'unicorn/max-nested-calls': 'off',
        'unicorn/no-array-reduce': 'off',
        'unicorn/no-null': 'off',
        'unicorn/no-object-as-default-parameter': 'off',
        'unicorn/no-useless-undefined': 'off',
        'vite-plus/prefer-vite-plus-imports': 'error',
      },
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
        'dagger:check': {
          ...commonTaskProps,
          command: 'cd dagger && vp check',
        },
        'dagger:format': {
          ...commonTaskProps,
          command: 'cd dagger && vp format',
        },
        'dagger:lint': {
          ...commonTaskProps,
          command: 'cd dagger && vp lint',
        },
        'dagger:test': {
          ...commonTaskProps,
          command: 'cd dagger && vp test',
        },
        'dagger:type-check': {
          ...commonTaskProps,
          command: 'cd dagger && tsc',
        },
        madge: {
          ...commonTaskProps,
          command:
            "madge --circular --warning --exclude '(dist|out|storybook-static|.wrangler|.pruned|coverage|tmp)' --ts-config ./tsconfig.madge.json --extensions ts,tsx packages apps",
        },
        plop: {
          cache: false,
          command: 'plop',
        },
        root: {
          ...commonTaskProps,
          command: 'vp check',
        },
      },
    },
    staged: {
      '*': 'vp check --fix',
    },
  };
};

export {
  getCommonTaskProps,
  getCommonViteConfig,
  getDotenvKeys,
  getEnvArray,
  getPackageViteConfig,
  getRootViteConfig,
  getTaskCache,
  ignorePatterns,
};

export default defineConfig(getRootViteConfig());
