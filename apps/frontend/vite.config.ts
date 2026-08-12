import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import unoCss from 'unocss/vite';
import { defineConfig } from 'vite-plus';

import { getPackageViteConfig } from '../../vite.config';

const port = Math.trunc(Number(globalThis.process.env['ADMIN_PORT'] ?? '3001'));

export default defineConfig(({ mode }) => {
  const dir = import.meta.dirname;

  const baseConfig = getPackageViteConfig({
    buildType: 'build',
    devCommand: 'vp dev',
    dir,
    excludeDevCommand: false,
    excludeStartCommand: false,
    mode,
    startCommand: 'vp preview',
  });

  const baseResolve =
    baseConfig.resolve && !Array.isArray(baseConfig.resolve) ? baseConfig.resolve : {};

  return {
    ...baseConfig,
    plugins: [
      react(),
      unoCss({
        configDeps: fs
          .readdirSync(path.resolve(dir, '../../packages/design-system/src'), {
            recursive: true,
          })
          .map(String)
          .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
          .map((file) => path.resolve(dir, '../../packages/design-system/src', file)),
        configFile: path.resolve(dir, '../../packages/design-system/uno.config.ts'),
      }),
    ],
    preview: {
      port,
    },
    resolve: {
      ...baseResolve,
      // alias: {
      //   '@lightproject/backend': path.resolve(dir, '../../apps/backend/src'),
      //   '@lightproject/common': path.resolve(dir, '../../packages/common/src'),
      //   '@lightproject/design-system': path.resolve(dir, '../../packages/design-system/src'),
      // },
    },
    server: {
      port,
    },
  };
});
