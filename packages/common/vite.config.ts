import { type UserConfig, defineConfig } from 'vite-plus';

import { getPackageViteConfig } from '../../vite.config.ts';

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;

  const baseConfig = getPackageViteConfig({ dir, mode });

  const basePack = baseConfig.pack && !Array.isArray(baseConfig.pack) ? baseConfig.pack : {};

  return {
    ...baseConfig,
    pack: {
      ...basePack,
      define: {
        'import.meta': '{}',
      },
      shims: false,
    },
    test: {
      ...baseConfig.test,
      coverage: {
        ...baseConfig.test?.coverage,
        exclude: ['**/index.ts'],
      },
    },
  };
});
