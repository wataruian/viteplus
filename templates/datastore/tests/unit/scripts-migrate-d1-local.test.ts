import path from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

const loadMigrateLocalD1 = async (migrate: () => Promise<void>) => {
  const dispose = vi.fn(async () => {});
  const getPlatformProxy = vi.fn(async () => await Promise.resolve({ dispose, env: { DB: 'DB' } }));
  const createD1Database = vi.fn((binding: string) => `db(${binding})`);
  const runMigrations = vi.fn(migrate);
  vi.doMock('wrangler', () => ({ getPlatformProxy }));
  vi.doMock('drizzle-orm/d1/migrator', () => ({ migrate: runMigrations }));
  vi.doMock('../../src/d1/client', () => ({ createD1Database }));
  const stdout = vi.spyOn(globalThis.process.stdout, 'write').mockReturnValue(true);
  const script = await import('../../src/scripts/migrate-d1-local');
  return { dispose, getPlatformProxy, runMigrations, script, stdout };
};

afterEach(() => {
  vi.doUnmock('wrangler');
  vi.doUnmock('drizzle-orm/d1/migrator');
  vi.doUnmock('../../src/d1/client');
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('migrateLocalD1', () => {
  test('migrates the shared local D1 state, then disposes the proxy', async () => {
    const run = await loadMigrateLocalD1(async () => {});
    const { packageDir } = run.script;

    await run.script.migrateLocalD1();

    expect(run.getPlatformProxy).toHaveBeenCalledExactlyOnceWith({
      configPath: path.join(packageDir, 'wrangler.toml'),
      persist: { path: path.resolve(packageDir, '../../.wrangler/state/v3') },
    });
    expect(run.runMigrations).toHaveBeenCalledExactlyOnceWith('db(DB)', {
      migrationsFolder: path.join(packageDir, 'migrations/d1'),
    });
    expect(run.stdout).toHaveBeenCalledWith('Local D1 is up to date\n');
    expect(run.dispose).toHaveBeenCalledOnce();
  });

  test('disposes the proxy when migrating fails', async () => {
    const run = await loadMigrateLocalD1(async () => {
      await Promise.reject(new Error('no such table'));
    });

    await expect(run.script.migrateLocalD1()).rejects.toThrow('no such table');
    expect(run.dispose).toHaveBeenCalledOnce();
    expect(run.stdout).not.toHaveBeenCalled();
  });
});
