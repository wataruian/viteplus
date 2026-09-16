import path from 'node:path';

import { type UserConfig, defineConfig } from 'vite-plus';

import { getPackageViteConfig } from '../../vite.config.ts';

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;

  const baseConfig = getPackageViteConfig({ dir, mode });
  const basePack = Array.isArray(baseConfig.pack) ? undefined : baseConfig.pack;
  const baseEntry = Array.isArray(basePack?.entry) ? basePack.entry : [];

  return {
    ...baseConfig,
    pack: {
      ...basePack,
      entry: [...baseEntry, '!src/**/import-meta-env.ts', '!src/**/import-meta-env.node.ts'],
      inputOptions: (options, format) => ({
        ...options,
        resolve: {
          ...options.resolve,
          alias:
            format === 'cjs'
              ? {
                  ...options.resolve?.alias,
                  '#import-meta-env': path.resolve(dir, 'src/environment/import-meta-env.node.ts'),
                }
              : (options.resolve?.alias ?? {}),
        },
      }),
    },
    test: {
      ...baseConfig.test,
      coverage: {
        ...baseConfig.test?.coverage,
        exclude: ['**/index.ts'],
      },
      setupFiles: ['./tests/helpers/setup.ts'],
    },
  };
});
