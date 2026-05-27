import { defineConfig } from 'vite-plus';
import { getPackageViteConfig } from '../../vite.config';

export default defineConfig(({ mode }) => {
  const dir = import.meta.dirname;
  return {
    ...getPackageViteConfig({
      dir,
      excludeDevCommand: false,
      excludeStartCommand: false,
      mode,
      startCommand: 'node dist/index.mjs',
    }),
  };
});
