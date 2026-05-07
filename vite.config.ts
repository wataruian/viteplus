import { type UserConfig, defineConfig, loadEnv } from 'vite-plus';
import path from 'node:path';

const commonIgnorePatterns = [
  '**/node_modules/**',
  '**/*.tsbuildinfo/**',
  '**/vite.config.d.ts/**',
  '**/vite.config.d.ts.map/**',
  '**/dist/**',
  '**/coverage/**',
  '**/tmp/**',
  '**/bak/**',
];

const commonRunInputs = [
  { auto: true },
  ...commonIgnorePatterns.map((ignorePattern) => `!${ignorePattern}`),
];

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
  const env = loadEnv(mode, rootDir, '');
  const isLocal = env['ENV'] === 'local';

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
        'capitalized-comments': 'off',
        'id-length': 'off',
        'max-depth': 'off',
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        'max-statements': 'off',
        'no-continue': 'off',
        'no-empty-function': 'off',
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
        'unicorn/no-array-reduce': 'off',
        'unicorn/no-null': 'off',
        'unicorn/no-useless-undefined': 'off',
      },
    },
    pack: {
      clean: true,
      dts: {
        sourcemap: isLocal,
        tsgo: true,
      },
      entry: ['src/**/*.ts', 'src/**/*.tsx'],
      exports: false,
      format: ['esm', 'cjs'],
      minify: !isLocal,
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
      include: ['tests/**/*.test.ts'],
    },
  };
};

const getPackageViteConfig = ({
  dir = import.meta.dirname,
  mode = 'development',
  buildType = 'pack',
  devCommand = 'tsx watch --conditions=typescript src/index.ts',
  startCommand = 'node dist/index.mjs',
  excludeDevCommand = true,
  excludeStartCommand = true,
}: {
  dir?: string;
  mode?: string;
  buildType?: 'build' | 'pack';
  devCommand?: string;
  startCommand?: string;
  excludeDevCommand?: boolean;
  excludeStartCommand?: boolean;
} = {}): UserConfig => ({
  ...getCommonViteConfig({ dir, isRoot: false, mode }),
  run: {
    tasks: {
      build: {
        command: `vp ${buildType}`,
        input: commonRunInputs,
      },
      format: {
        command: 'vp fmt',
        input: commonRunInputs,
      },
      lint: {
        command: 'vp lint',
        input: commonRunInputs,
      },
      test: {
        command: 'vp test',
        input: commonRunInputs,
      },
      'type-check': {
        command: 'tsc',
        input: commonRunInputs,
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
});

const getRootViteConfig = (): UserConfig => ({
  ...getCommonViteConfig({
    dir: import.meta.dirname,
    isRoot: true,
    mode: globalThis.process.env['NODE_ENV'] ?? 'development',
  }),
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
  commonIgnorePatterns,
  commonRunInputs,
  getCommonViteConfig,
  getPackageViteConfig,
  getRootViteConfig,
};

export default defineConfig(getRootViteConfig());
