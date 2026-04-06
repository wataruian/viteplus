import { commonViteConfig } from '../../vite.config';
import { defineConfig } from 'vite-plus';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import unoConfig from '@lightproject/design-system/uno.config';
import unocss from 'unocss/vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...commonViteConfig,
  plugins: [react(), unocss(unoConfig)],
  resolve: {
    alias: {
      '@lightproject/common': path.resolve(dirname, '../../packages/common/src'),
      '@lightproject/design-system': path.resolve(dirname, '../../packages/design-system/src'),
      '@lightproject/design-system/uno.config': path.resolve(
        dirname,
        '../../packages/design-system/uno.config.ts',
      ),
    },
  },
  server: {
    port: 3001,
  },
});
