import path from 'node:path';

import { type UserConfig, defineConfig, mergeConfig } from 'vite-plus';

import { getPackageViteConfig } from '../../vite.config.ts';

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;

  return mergeConfig(getPackageViteConfig({ dir, mode }), {
    pack: {
      entry: ['!src/**/import-meta-env.ts', '!src/**/import-meta-env.node.ts'],
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
      coverage: {
        exclude: ['**/index.ts'],
      },
      setupFiles: ['./tests/helpers/setup.ts'],
    },
  } satisfies UserConfig);
});
