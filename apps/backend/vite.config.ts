import { defineConfig, loadEnv } from 'vite-plus';
import { getCommonViteConfig, getPackageViteConfig } from '../../vite.config';
import path from 'node:path';
import { VitePluginNode as vitePluginNode } from 'vite-plugin-node';

const port = Number.parseInt(globalThis.process.env['API_PORT'] ?? '3000', 10);

export default defineConfig(({ mode }) => {
  const dir = import.meta.dirname;
  const rootDir = path.resolve(dir, '../..');
  const env = loadEnv(mode, rootDir, '');
  const isLocalViteEnv = env['ENV'] === 'local';

  return {
    ...getCommonViteConfig(isLocalViteEnv),
    ...getPackageViteConfig({
      devCommand: 'vp dev',
      excludeDevCommand: false,
      excludeStartCommand: false,
      startCommand: 'USE_VITE_BACKEND=false node dist/index.mjs',
    }),
    plugins: [
      ...vitePluginNode({
        adapter: 'express',
        appPath: './src/index.ts',
        exportName: 'app',
      }),
    ],
    resolve: {
      alias: {
        '@lightproject/common': path.resolve(dir, '../../packages/common/src'),
      },
    },
    server: {
      port,
    },
  };
});
