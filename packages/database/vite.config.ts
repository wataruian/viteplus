import path from 'node:path';

import { type UserConfig, defineConfig, mergeConfig } from 'vite-plus';

import { getCommonTaskProps, getPackageViteConfig } from '../../vite.config.ts';

const isIntegration = globalThis.process.env['TEST_SUITE'] === 'integration';

const postgresConfig = '--config drizzle.postgres.config.ts';
const d1Config = '--config drizzle.d1.config.ts';

export { d1Config, isIntegration, postgresConfig };

export default defineConfig(({ mode }): UserConfig => {
  const dir = import.meta.dirname;
  const rootDir = path.resolve(dir, '../..');
  const commonTaskProps = getCommonTaskProps(rootDir, mode);

  return mergeConfig(
    getPackageViteConfig({
      dir,
      mode,
    }),
    {
      run: {
        tasks: {
          'db:check': {
            cache: false,
            command: `drizzle-kit check ${postgresConfig} && drizzle-kit check ${d1Config}`,
          },
          'db:generate': {
            cache: false,
            command: 'tsx --conditions=typescript scripts/generate.ts',
          },
          'db:migrate:d1:local': {
            cache: false,
            command: 'tsx --conditions=typescript scripts/migrate-d1-local.ts',
          },
          'db:migrate:d1:remote': {
            cache: false,
            command: 'tsx --conditions=typescript scripts/migrate-d1-remote.ts',
          },
          'db:migrate:postgres': {
            cache: false,
            command: `drizzle-kit migrate ${postgresConfig}`,
          },
          'db:studio': {
            cache: false,
            command: `drizzle-kit studio ${postgresConfig}`,
          },
          'test:integration': {
            cache: {
              ...commonTaskProps.cache,
            },
            command: 'TEST_SUITE=integration vp test',
          },
        },
      },
      test: {
        coverage: {
          enabled: !isIntegration,
          exclude: ['**/index.ts', 'src/types.ts'],
        },
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
