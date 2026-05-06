import { type UserConfig, defineConfig, loadEnv } from 'vite-plus';

const getCommonViteConfig = (_mode: string, env: Record<string, string>): UserConfig => {
  const viteEnv = env['VITE_ENV'] ?? undefined;
  const isLocalViteEnv = viteEnv === 'local';
  return {
    fmt: {
      arrowParens: 'always',
      bracketSameLine: false,
      bracketSpacing: true,
      endOfLine: 'lf',
      ignorePatterns: ['bak'],
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
      ignorePatterns: ['bak'],
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
        sourcemap: isLocalViteEnv,
        tsgo: true,
      },
      entry: ['src/**/*.ts', 'src/**/*.tsx'],
      exports: false,
      format: ['esm', 'cjs'],
      minify: !isLocalViteEnv,
      shims: true,
      sourcemap: isLocalViteEnv,
      treeshake: true,
      unbundle: isLocalViteEnv,
    },
    test: {
      coverage: {
        enabled: true,
        include: ['tests/**/*.test.ts'],
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        reportsDirectory: 'coverage',
      },
    },
  };
};

const getViteConfig = {
  run: {
    cache: {
      scripts: true,
      tasks: true,
    },
    tasks: {
      build: {
        command: 'vp run -r build',
        input: [{ auto: true }, '!**/*.tsbuildinfo', '!**/dist/**', '!**/coverage/**'],
      },
      dev: {
        command: 'vp run -r dev',
      },
      'dev:watch': {
        command: 'vp run -r dev:watch',
      },
      format: {
        command: 'vp fmt',
        input: [{ auto: true }],
      },
      lint: {
        command: 'vp lint',
        input: [{ auto: true }],
      },
      start: {
        command: 'vp run -r start',
      },
      test: {
        command: 'vp run -r test',
        input: [{ auto: true }, '!**/*.tsbuildinfo', '!**/dist/**', '!**/coverage/**'],
      },
      watch: {
        command: 'vp run -r watch',
      },
    },
  },
  staged: {
    '*': 'vp check --fix',
  },
};

const dir = import.meta.dirname;
const mode = globalThis.process.env['NODE_ENV'] ?? 'development';
const env = loadEnv(mode, dir);

export default defineConfig({
  ...getCommonViteConfig(mode, env),
  ...getViteConfig,
});

export { getCommonViteConfig, getViteConfig };
