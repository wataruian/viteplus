import { commonViteConfig } from '../../vite.config';
import { defineConfig } from 'vite-plus';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import unoCss from 'unocss/vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...commonViteConfig,
  plugins: [
    react(),
    unoCss({
      configDeps: fs
        .readdirSync(path.resolve(dirname, '../../packages/design-system/src'), { recursive: true })
        .map(String)
        .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
        .map((file) => path.resolve(dirname, '../../packages/design-system/src', file)),
      configFile: path.resolve(dirname, '../../packages/design-system/uno.config.ts'),
    }),
  ],
  resolve: {
    alias: {
      '@lightproject/common': path.resolve(dirname, '../../packages/common/src'),
      '@lightproject/design-system': path.resolve(dirname, '../../packages/design-system/src'),
    },
  },
  server: {
    port: 3001,
  },
});
