import { type UserConfig, defineConfig, mergeConfig } from 'vite-plus';

import { getPackageViteConfig } from '../../vite.config.ts';

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;

  return mergeConfig(
    getPackageViteConfig({
      dir,
      mode,
    }),
    {
      test: {
        coverage: {
          exclude: ['**/index.ts'],
        },
      },
    } satisfies UserConfig,
  );
});
