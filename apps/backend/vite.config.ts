import { commonViteConfig } from '../../vite.config';
import { defineConfig } from 'vite-plus';
import path from 'node:path';
import { VitePluginNode as vitePluginNode } from 'vite-plugin-node';

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
    port: 3000,
  },
});
