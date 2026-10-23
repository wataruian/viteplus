import { afterAll, afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { db } from '../../src';
import { startLocalD1 } from '../shared/local-d1';

const { createDatabase, resolvePostgresUrl } = db;

const unreachable = 'postgres://u@127.0.0.1:1/none';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createDatabase', async () => {
  const local = await startLocalD1();

  afterAll(async () => {
    await local.dispose();
  });

  test('d1: queries the env.DB binding', async () => {
    const database = await createDatabase({ DATABASE_DIALECT: 'd1', DB: local.binding });

    expect(database.dialect).toBe('d1');
    const user = await database.users.insert({
      email: `${globalThis.crypto.randomUUID()}@example.com`,
      name: 'Ada',
    });
    await expect(database.users.findById(user.id)).resolves.toStrictEqual(user);
    await expect(database.close()).resolves.toBeUndefined();
  });

  test('d1: requires the binding', async () => {
    await expect(createDatabase({ DATABASE_DIALECT: 'd1' })).rejects.toThrow(
      'no D1 binding was passed as env.DB',
    );
  });

  test('postgres: connects lazily, so it can be created and closed offline', async () => {
    const database = await createDatabase({
      DATABASE_DIALECT: 'postgres',
      POSTGRES_URL: unreachable,
    });

    expect(database.dialect).toBe('postgres');
    await expect(database.close()).resolves.toBeUndefined();
  });

  test('falls back to DATABASE_DIALECT from the process env', async () => {
    vi.stubEnv('DATABASE_DIALECT', 'postgres');
    vi.stubEnv('POSTGRES_URL', unreachable);

    const database = await createDatabase();

    expect(database.dialect).toBe('postgres');
    await database.close();
  });

  test('rejects an unknown dialect', async () => {
    await expect(createDatabase({ DATABASE_DIALECT: 'mysql' })).rejects.toThrow(
      "Set DATABASE_DIALECT to one of: d1, postgres (got 'mysql')",
    );
  });
});

describe('resolvePostgresUrl', () => {
  test('prefers Hyperdrive, then POSTGRES_URL, then the POSTGRES_* env', () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://from-process');

    expect(
      resolvePostgresUrl({
        HYPERDRIVE: { connectionString: 'postgres://hyperdrive' },
        POSTGRES_URL: 'postgres://env',
      }),
    ).toBe('postgres://hyperdrive');
    expect(resolvePostgresUrl({ POSTGRES_URL: 'postgres://env' })).toBe('postgres://env');
    expect(resolvePostgresUrl({})).toBe('postgres://from-process');
  });
});
