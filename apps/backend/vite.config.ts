import type { PackUserConfig } from 'vite-plus/pack';
import { defineConfig } from 'vite-plus';
import { getPackageViteConfig } from '../../vite.config';

export default defineConfig(({ mode }) => {
  const dir = import.meta.dirname;

  const baseConfig = getPackageViteConfig({
    dir,
    excludeDevCommand: false,
    excludeStartCommand: false,
    mode,
    startCommand: 'node dist/index.mjs',
  });

  const basePack: PackUserConfig =
    baseConfig.pack && !Array.isArray(baseConfig.pack) ? baseConfig.pack : {};

  return {
    ...baseConfig,
    pack: {
      ...basePack,
      deps: {
        neverBundle: ['express-serve-static-core', 'extend', 'mock-express'],
      },
    },
  };
});
