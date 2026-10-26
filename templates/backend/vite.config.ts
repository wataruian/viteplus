import fs from 'node:fs';
import path from 'node:path';

import { type UserConfig, defineConfig, mergeConfig } from 'vite-plus';

import { getPackageViteConfig } from '../../vite.config.ts';

const port = Math.trunc(Number(globalThis.process.env['BACKEND_PORT'] ?? '2000'));
const inspectorPort = Math.trunc(
  Number(globalThis.process.env['BACKEND_INSPECTOR_PORT'] ?? '8230'),
);

export { inspectorPort, port };

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;
  const rootDir = path.resolve(dir, '../..');
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
            cache: false,
            command: `wrangler delete`,
          },
          'wrangler:deploy': {
            cache: false,
            command: `wrangler deploy`,
          },
          'wrangler:dev': {
            cache: false,
            command: `wrangler dev --port ${port} --inspector-port ${inspectorPort} --show-interactive-dev-session=false`,
          },
        },
      },
      test: {
        coverage: {
          exclude: ['**/index.ts', 'src/client.ts', 'src/runtimes/**'],
        },
        env: { SKIP_OPENTELEMETRY: 'true' },
        isolate: true,
      },
    } satisfies UserConfig,
  );
});
