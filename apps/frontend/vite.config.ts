import { defineConfig } from 'vite-plus';
import fs from 'node:fs';
import { getPackageViteConfig } from '../../vite.config';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import unoCss from 'unocss/vite';

const port = Number.parseInt(globalThis.process.env['ADMIN_PORT'] ?? '3001', 10);

export default defineConfig(({ mode }) => {
  const dir = import.meta.dirname;
  return {
    ...getPackageViteConfig({
      buildType: 'build',
      devCommand: 'vp dev',
      dir,
      excludeDevCommand: false,
      excludeStartCommand: false,
      mode,
      startCommand: 'vp preview',
    }),
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
      alias: {
        '@lightproject/common': path.resolve(dir, '../../packages/common/src'),
        '@lightproject/design-system': path.resolve(dir, '../../packages/design-system/src'),
      },
    },
    server: {
      port,
    },
  };
});
