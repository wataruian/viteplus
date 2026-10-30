import fs from 'node:fs';
import path from 'node:path';

import { type UserConfig, defineConfig, mergeConfig } from 'vite-plus';

import { getCommonTaskProps, getPackageViteConfig } from '../../vite.config.ts';

const inspectorPort = Math.trunc(Number(globalThis.process.env['TASKS_INSPECTOR_PORT'] ?? '8232'));
const wranglerPort = Math.trunc(Number(globalThis.process.env['TASKS_PORT'] ?? '2002'));

const isIntegration = globalThis.process.env['TEST_SUITE'] === 'integration';

export { inspectorPort, isIntegration, wranglerPort };

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;
  const rootDir = path.resolve(dir, '../..');
  const commonTaskProps = getCommonTaskProps(rootDir, mode);
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
      startCommand: 'vpx dist/index.mjs',
    }),
    {
      pack: {
        outputOptions: { exports: 'named' },
      },
      run: {
        tasks: {
          enqueue: {
            cache: false,
            command: 'vpx --conditions=typescript src/scripts/enqueue.ts',
          },
          'test:integration': {
            cache: {
              ...commonTaskProps.cache,
              output: [{ base: 'package', pattern: 'e2e-test-results/**/*' }],
            },
            command: 'TEST_SUITE=integration vp test',
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
          enabled: !isIntegration,
          exclude: [
            '**/index.ts',
            'src/client.ts',
            'src/core/job.ts',
            'src/core/store.ts',
            'src/runtimes/**',
          ],
        },
        env: { JOB_STORE: 'memory', SKIP_OPENTELEMETRY: 'true' },
        ...(isIntegration
          ? {
              exclude: ['tests/unit/**'],
              fileParallelism: false,
              include: ['tests/integration/**/*.test.ts'],
            }
          : {}),
      },
    } satisfies UserConfig,
  );
});
