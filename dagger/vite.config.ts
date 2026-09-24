import path from 'node:path';

import { type UserConfig, defineConfig, mergeConfig } from 'vite-plus';

import { getCommonViteConfig } from '../vite.config.ts';

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;

  return mergeConfig(getCommonViteConfig({ dir, mode, pathToRoot: '..' }), {
    resolve: {
      alias: {
        '@dagger.io/dagger': path.resolve(dir, 'sdk/index.ts'),
      },
    },
    test: {
      setupFiles: ['tests/helpers/setup.ts'],
    },
  } satisfies UserConfig);
});
