import { commonViteConfig } from '../../vite.config';
import { defineConfig } from 'vite-plus';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { VitePluginNode as vitePluginNode } from 'vite-plugin-node';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...commonViteConfig,
  plugins: [
    ...vitePluginNode({
      adapter: 'express',
      appPath: './src/index.ts',
      exportName: 'app',
    }),
  ],
  resolve: {
    alias: {
      '@lightproject/common': path.resolve(dirname, '../../packages/common/src'),
    },
  },
  server: {
    port: 3000,
  },
});
