import path from 'node:path';

import { type UserConfig, defineConfig } from 'vite-plus';

import { getCommonViteConfig } from '../vite.config.ts';

// TEMPORARY — remove alongside src/helpers/__semgrep_test_fixture.ts once local
// semgrep testing is done.
const SEMGREP_TEST_FIXTURE = 'src/helpers/__semgrep_test_fixture.ts';

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;

  const baseConfig = getCommonViteConfig({ dir, mode, pathToRoot: '..' });

  return {
    ...baseConfig,
    fmt: {
      ...baseConfig.fmt,
      ignorePatterns: [...(baseConfig.fmt?.ignorePatterns ?? []), SEMGREP_TEST_FIXTURE],
    },
    lint: {
      ...baseConfig.lint,
      ignorePatterns: [...(baseConfig.lint?.ignorePatterns ?? []), SEMGREP_TEST_FIXTURE],
    },
    resolve: {
      ...baseConfig.resolve,
      alias: {
        '@dagger.io/dagger': path.resolve(dir, 'sdk/index.ts'),
      },
    },
    test: {
      ...baseConfig.test,
      coverage: {
        ...baseConfig.test?.coverage,
        exclude: [...(baseConfig.test?.coverage?.exclude ?? []), SEMGREP_TEST_FIXTURE],
      },
      setupFiles: ['tests/helpers/setup.ts'],
    },
  };
});
