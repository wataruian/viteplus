import { type UserConfig, defineConfig, loadEnv } from 'vite-plus';

const commonIgnorePatterns = [
  '**/node_modules/**',
  '**/*.tsbuildinfo/**',
  '**/vite.config.d.ts/**',
  '**/vite.config.d.ts.map/**',
  '**/dist/**',
  '**/coverage/**',
  '**/bak/**',
];

const getCommonViteConfig = (isLocal: boolean): UserConfig => ({
  fmt: {
    arrowParens: 'always',
    bracketSameLine: false,
    bracketSpacing: true,
    endOfLine: 'lf',
    ignorePatterns: commonIgnorePatterns,
    jsxSingleQuote: true,
    quoteProps: 'as-needed',
    quotes: 'single',
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
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
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});

const commonRunInputs = [
  { auto: true },
  ...commonIgnorePatterns.map((ignorePattern) => `!${ignorePattern}`),
];

const getPackageViteConfig = ({
  buildType = 'pack',
  devCommand = 'tsx watch --conditions=typescript src/index.ts',
  startCommand = 'node dist/index.mjs',
  excludeDevCommand = true,
  excludeStartCommand = true,
}: {
  buildType?: 'build' | 'pack';
  devCommand?: string;
  startCommand?: string;
  excludeDevCommand?: boolean;
  excludeStartCommand?: boolean;
} = {}): UserConfig => ({
  run: {
    tasks: {
      build: {
        command: `tsc && vp ${buildType}`,
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

const dir = import.meta.dirname;
const mode = globalThis.process.env['NODE_ENV'] ?? 'development';
const env = loadEnv(mode, dir, '');
const isLocalViteEnv = env['ENV'] === 'local';

export default defineConfig({
  ...getCommonViteConfig(isLocalViteEnv),
  ...getRootViteConfig(),
});

export {
  commonIgnorePatterns,
  commonRunInputs,
  getCommonViteConfig,
  getPackageViteConfig,
  getRootViteConfig,
};
