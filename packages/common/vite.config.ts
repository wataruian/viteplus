import { defineConfig } from 'vite-plus';

import { getPackageViteConfig } from '../../vite.config';

export default defineConfig(({ mode }) => getPackageViteConfig({ dir: import.meta.dirname, mode }));
