import fs from 'node:fs';
import path from 'node:path';

import { type UserConfig, defineConfig, mergeConfig } from 'vite-plus';

import { getPackageViteConfig } from '../../vite.config.ts';

const inspectorPort = Math.trunc(
  Number(globalThis.process.env['SCHEDULER_INSPECTOR_PORT'] ?? '8233'),
);
const wranglerPort = Math.trunc(Number(globalThis.process.env['SCHEDULER_PORT'] ?? '2003'));

export { inspectorPort, wranglerPort };

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
      excludeStartCommand: false,
      mode,
      startCommand: 'vpx dist/index.mjs',
    }),
    {
      run: {
        tasks: {
          script: {
            cache: false,
            command: 'vpx --conditions=typescript src/index.ts',
          },
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
            command: `wrangler dev --test-scheduled --persist-to ../../.wrangler/state --port ${wranglerPort} --inspector-port ${inspectorPort} --show-interactive-dev-session=false`,
          },
        },
      },
      test: {
        coverage: {
          exclude: ['**/index.ts', 'src/client.ts', 'src/runtimes/**'],
        },
        env: { SKIP_OPENTELEMETRY: 'true' },
      },
    } satisfies UserConfig,
  );
});
