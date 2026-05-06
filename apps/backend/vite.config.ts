import { commonViteConfig } from '../../vite.config';
import { defineConfig } from 'vite-plus';
import path from 'node:path';
import { VitePluginNode as vitePluginNode } from 'vite-plugin-node';

const port = Number.parseInt(globalThis.process.env['API_PORT'] ?? '3000', 10);

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
      '@lightproject/common': path.resolve(import.meta.dirname, '../../packages/common/src'),
    },
  },
  server: {
    port,
  },
});
