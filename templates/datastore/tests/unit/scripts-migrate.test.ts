import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { ExitError, stubProcessExit } from './helpers/process-exit';

const loadMigrate = async () => {
  const migratePostgres = vi.fn(async () => {});
  const migrateLocalD1 = vi.fn(async () => {});
  const migrateRemoteD1 = vi.fn(async () => {});
  vi.doMock('../../src/scripts/migrate-postgres', () => ({ migratePostgres }));
  vi.doMock('../../src/scripts/migrate-d1-local', () => ({ migrateLocalD1 }));
  vi.doMock('../../src/scripts/migrate-d1-remote', () => ({ migrateRemoteD1 }));
  const script = await import('../../src/scripts/migrate');
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
  return { migrateLocalD1, migratePostgres, migrateRemoteD1, script };
};

afterEach(() => {
  vi.doUnmock('../../src/scripts/migrate-postgres');
  vi.doUnmock('../../src/scripts/migrate-d1-local');
  vi.doUnmock('../../src/scripts/migrate-d1-remote');
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('db:migrate', () => {
  test('runs on import and migrates Postgres for DATABASE_DIALECT=postgres', async () => {
    vi.stubEnv('DATABASE_DIALECT', 'postgres');

    const run = await loadMigrate();

    expect(run.migratePostgres).toHaveBeenCalledOnce();
    expect(run.migrateLocalD1).not.toHaveBeenCalled();
    expect(run.migrateRemoteD1).not.toHaveBeenCalled();
  });

  test.each([
    ['', 'migrateLocalD1'],
    ['develop', 'migrateRemoteD1'],
  ] as const)('d1 with CLOUDFLARE_ENV=%j runs %s', async (cloudflareEnv, expected) => {
    vi.stubEnv('DATABASE_DIALECT', 'd1');
    vi.stubEnv('CLOUDFLARE_ENV', cloudflareEnv);

    const run = await loadMigrate();

    expect(run[expected]).toHaveBeenCalledOnce();
    expect(run.migratePostgres).not.toHaveBeenCalled();
  });

  test('rejects an unknown dialect', async () => {
    vi.stubEnv('DATABASE_DIALECT', 'postgres');
    const run = await loadMigrate();
    vi.stubEnv('DATABASE_DIALECT', 'mysql');

    await expect(run.script.migrate()).rejects.toThrow('Set DATABASE_DIALECT to one of');
  });
});

const loadFail = async () => {
  vi.stubEnv('DATABASE_DIALECT', 'postgres');
  const { script } = await loadMigrate();
  const stderr = vi.spyOn(globalThis.process.stderr, 'write').mockReturnValue(true);
  stubProcessExit();
  return { fail: script.fail, stderr };
};

describe('fail', () => {
  test.each([
    [
      'an error with a stack',
      Object.assign(new Error('boom'), { stack: 'Error: boom\n  at x' }),
      'Error: boom\n  at x',
    ],
    ['an error without a stack', Object.assign(new Error('boom'), { stack: undefined }), 'boom'],
    ['a non-Error value', { code: 1 }, '{"code":1}'],
  ])('reports %s and exits 1', async (_case, error, reason) => {
    const { fail, stderr } = await loadFail();

    expect(() => {
      fail(error);
    }).toThrow(new ExitError(1));
    expect(stderr).toHaveBeenCalledWith(`Migration failed: ${reason}\n`);
  });
});
