import { type UserConfig, defineConfig } from 'vite-plus';

import { getPackageViteConfig } from '../../vite.config.ts';

export default defineConfig(({ mode }): UserConfig => {
  const baseConfig = getPackageViteConfig({ dir: import.meta.dirname, mode });

  return {
    ...baseConfig,
    test: {
      ...baseConfig.test,
      coverage: {
        ...baseConfig.test?.coverage,
        exclude: ['**/index.ts'],
      },
    },
  };
});
