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
            command: 'vpx --conditions=typescript src/scripts/generate.ts',
          },
          'db:migrate': {
            cache: false,
            command: 'vpx dist/scripts/migrate.mjs',
          },
          'db:studio': {
            cache: false,
            command: `drizzle-kit studio ${postgresConfig}`,
          },
          'test:integration': {
            cache: {
              ...commonTaskProps.cache,
              env: [...(commonTaskProps.cache.env ?? []), 'POSTGRES_*', 'DATASTORE_POSTGRES_*'],
            },
            command: [
              'DATABASE_DIALECT=postgres TEST_SUITE=integration vp test',
              'DATABASE_DIALECT=d1 TEST_SUITE=integration vp test',
            ],
          },
        },
      },
      test: {
        coverage: {
          enabled: !isIntegration,
          exclude: [
            '**/index.ts',
            'src/repositories/table.ts',
            'src/repositories/types.ts',
            'src/types.ts',
          ],
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
