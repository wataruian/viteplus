import fs from 'node:fs';
import path from 'node:path';

import { type UserConfig, defineConfig, loadEnv } from 'vite-plus';

const ignorePatterns = [
  'node_modules',
  'bak',
  'dist',
  'coverage',
  'tmp',
  'vite.config.d.ts',
  'vite.config.d.ts.map',
  'tsconfig.tsbuildinfo',
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

const getCommonRunProps = (rootDir: string, mode: string) => {
  const envArray = getEnvArray(rootDir, mode);
  const input = ignorePatterns.map((pattern) => `!${pattern}`);
  return { env: envArray, input };
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
      rolldownOptions: {
        external: [
          'node:async_hooks',
          'node:crypto',
          'node:fs',
          'node:path',
          'node:url',
          'node_util',
          'child_process',
          'fs',
          'fs/promises',
          'path',
          'stream',
          'timers',
          'util',
          'zlib',
        ],
      },
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
      ignorePatterns,
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
        'sort-imports': ['error', { ignoreDeclarationSort: true }],
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

  const commonRunProps = getCommonRunProps(rootDir, mode);

  return {
    ...getCommonViteConfig({ dir, isRoot, mode }),
    run: {
      tasks: {
        build: {
          command: `vp ${buildType}`,
          ...commonRunProps,
          output: [
            {
              base: 'package',
              pattern: 'dist/**/*',
            },
          ],
        },
        check: {
          command: 'vp check',
          ...commonRunProps,
        },
        format: {
          command: 'vp fmt',
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

  const commonRunProps = getCommonRunProps(dir, mode);

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
        madge: {
          command:
            "madge --circular --warning --exclude '(dist|coverage|tmp)' --ts-config ./tsconfig.madge.json --extensions ts,tsx packages apps",
          ...commonRunProps,
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
