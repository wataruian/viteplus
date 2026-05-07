import { defineConfig, loadEnv } from 'vite-plus';
import { getCommonViteConfig, getPackageViteConfig } from '../../vite.config';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const dir = import.meta.dirname;
  const rootDir = path.resolve(dir, '../..');
  const env = loadEnv(mode, rootDir, '');
  const isLocalViteEnv = env['ENV'] === 'local';

  return {
    ...getCommonViteConfig(isLocalViteEnv),
    ...getPackageViteConfig(),
  };
});
