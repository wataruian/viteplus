import { type UserConfig, defineConfig } from 'vite-plus';

import { getPackageViteConfig } from '../../vite.config.ts';

export default defineConfig(({ mode }): UserConfig =>
  getPackageViteConfig({ dir: import.meta.dirname, mode }),
);
