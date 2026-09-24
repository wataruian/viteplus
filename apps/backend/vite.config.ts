import fs from 'node:fs';
import path from 'node:path';

import { type UserConfig, defineConfig, mergeConfig } from 'vite-plus';

import { getCommonRunProps, getPackageViteConfig } from '../../vite.config.ts';

const port = Math.trunc(Number(globalThis.process.env['API_PORT'] ?? '3000'));

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;
  const rootDir = path.resolve(dir, '../..');
  const commonRunProps = getCommonRunProps(rootDir, mode);
  const packageEnvPath = path.resolve(dir, '.env');
  const rootEnvPath = path.resolve(rootDir, '.env');

  if (!fs.existsSync(packageEnvPath) && fs.existsSync(rootEnvPath)) {
    try {
      fs.symlinkSync(path.relative(dir, rootEnvPath), packageEnvPath);
    } catch {
      fs.copyFileSync(rootEnvPath, packageEnvPath);
    }
  }

  return mergeConfig(
    getPackageViteConfig({
      dir,
      excludeDevCommand: false,
      excludeStartCommand: false,
      mode,
      startCommand: 'node dist/index.mjs',
    }),
    {
      run: {
        tasks: {
          'wrangler:delete': {
            command: `wrangler delete`,
            ...commonRunProps,
          },
          'wrangler:deploy': {
            command: `wrangler deploy`,
            ...commonRunProps,
          },
          'wrangler:dev': {
            command: `wrangler dev --port ${port} --inspector-port 9230 --show-interactive-dev-session=false`,
            ...commonRunProps,
          },
        },
      },
      test: {
        coverage: {
          exclude: ['**/index.ts', 'src/client.ts', 'src/runtimes/**'],
        },
        isolate: true,
      },
    } satisfies UserConfig,
  );
});
