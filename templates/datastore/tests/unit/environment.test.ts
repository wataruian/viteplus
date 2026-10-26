import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { resolveDatabaseDialect } from '../../src/environment/dialect';
import {
  getCloudflareEnv,
  getDatabaseDialect,
  getPostgresDb,
  getPostgresHost,
  getPostgresPassword,
  getPostgresPort,
  getPostgresUrl,
  getPostgresUser,
} from '../../src/environment/variables';

const postgresKeys = [
  'DATASTORE_POSTGRES_DB',
  'POSTGRES_HOST',
  'POSTGRES_PASSWORD',
  'POSTGRES_PORT',
  'DATASTORE_POSTGRES_URL',
  'POSTGRES_USER',
];

const unsetPostgres = () => {
  for (const key of postgresKeys) {
    vi.stubEnv(key, undefined);
  }
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('postgres variables', () => {
  test('default to the local docker-compose Postgres', () => {
    unsetPostgres();

    expect([
      getPostgresUser(),
      getPostgresPassword(),
      getPostgresHost(),
      getPostgresPort(),
      getPostgresDb(),
    ]).toStrictEqual([
      'lightproject',
      'lightproject',
      'localhost',
      '5432',
      'lightproject_datastore',
    ]);
    expect(getPostgresUrl()).toBe(
      'postgres://lightproject:lightproject@localhost:5432/lightproject_datastore',
    );
  });

  test('build the URL from the shared POSTGRES_* server parts and DATASTORE_POSTGRES_DB', () => {
    unsetPostgres();
    vi.stubEnv('POSTGRES_USER', 'me');
    vi.stubEnv('POSTGRES_PASSWORD', 'p@ss/word');
    vi.stubEnv('POSTGRES_HOST', 'db');
    vi.stubEnv('POSTGRES_PORT', '6543');
    vi.stubEnv('DATASTORE_POSTGRES_DB', 'app');

    expect(getPostgresUrl()).toBe('postgres://me:p%40ss%2Fword@db:6543/app');
  });

  test('prefer DATASTORE_POSTGRES_URL over the parts', () => {
    vi.stubEnv('POSTGRES_HOST', 'ignored');
    vi.stubEnv('DATASTORE_POSTGRES_URL', 'postgres://x');

    expect(getPostgresUrl()).toBe('postgres://x');
  });
});

describe('database dialect', () => {
  test('reads DATABASE_DIALECT and CLOUDFLARE_ENV, empty when unset', () => {
    vi.stubEnv('DATABASE_DIALECT', undefined);
    vi.stubEnv('CLOUDFLARE_ENV', undefined);
    expect([getDatabaseDialect(), getCloudflareEnv()]).toStrictEqual(['', '']);

    vi.stubEnv('DATABASE_DIALECT', 'd1');
    vi.stubEnv('CLOUDFLARE_ENV', 'develop');
    expect([getDatabaseDialect(), getCloudflareEnv()]).toStrictEqual(['d1', 'develop']);
  });

  test.each(['d1', 'postgres'])('resolves %s', (dialect) => {
    vi.stubEnv('DATABASE_DIALECT', dialect);

    expect(resolveDatabaseDialect()).toBe(dialect);
  });

  test.each(['', 'mysql'])('rejects %j', (dialect) => {
    expect(() => resolveDatabaseDialect(dialect)).toThrow(
      `Set DATABASE_DIALECT to one of: d1, postgres (got '${dialect}')`,
    );
  });
});
