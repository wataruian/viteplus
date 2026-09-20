import path from 'node:path';

import { type UserConfig, defineConfig } from 'vite-plus';

import { getCommonViteConfig } from '../vite.config.ts';

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;

  const baseConfig = getCommonViteConfig({ dir, mode, pathToRoot: '..' });

  return {
    ...baseConfig,
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
      },
      setupFiles: ['tests/helpers/setup.ts'],
    },
  };
});
