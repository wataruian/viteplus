import path from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

const loadMigratePostgres = async (migrate: () => Promise<void>) => {
  const close = vi.fn(async () => {});
  const createPostgresDatabase = vi.fn(() => ({ close, db: 'db' }));
  vi.doMock('drizzle-orm/postgres-js/migrator', () => ({ migrate: vi.fn(migrate) }));
  vi.doMock('../../src/postgres/client', () => ({ createPostgresDatabase }));
  const stdout = vi.spyOn(globalThis.process.stdout, 'write').mockReturnValue(true);
  const migrator = await import('drizzle-orm/postgres-js/migrator');
  const script = await import('../../src/scripts/migrate-postgres');
  return { close, createPostgresDatabase, migrator, script, stdout };
};

afterEach(() => {
  vi.doUnmock('drizzle-orm/postgres-js/migrator');
  vi.doUnmock('../../src/postgres/client');
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('migratePostgres', () => {
  test('migrates POSTGRES_URL from migrations/postgres over one connection, then closes it', async () => {
    vi.stubEnv('POSTGRES_URL', 'postgres://target');
    const run = await loadMigratePostgres(async () => {});

    await run.script.migratePostgres();

    expect(run.createPostgresDatabase).toHaveBeenCalledExactlyOnceWith({
      max: 1,
      url: 'postgres://target',
    });
    expect(run.migrator.migrate).toHaveBeenCalledExactlyOnceWith('db', {
      migrationsFolder: path.resolve('migrations/postgres'),
    });
    expect(run.close).toHaveBeenCalledOnce();
    expect(run.stdout).toHaveBeenCalledWith('Postgres is up to date\n');
  });

  test('closes the connection when migrating fails', async () => {
    const run = await loadMigratePostgres(async () => {
      await Promise.reject(new Error('relation exists'));
    });

    await expect(run.script.migratePostgres()).rejects.toThrow('relation exists');
    expect(run.close).toHaveBeenCalledOnce();
    expect(run.stdout).not.toHaveBeenCalled();
  });
});
