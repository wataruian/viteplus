import fs from 'node:fs';

import { afterAll, afterEach, describe, expect, test, vi } from 'vite-plus/test';

import {
  joinStatements,
  migrateRemoteD1,
  migrationsFolder,
} from '../../src/scripts/migrate-d1-remote';
import { startFakeD1Api } from './helpers/fake-d1-api';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('joinStatements', () => {
  test('joins statements with one terminator each and drops empty ones', () => {
    expect(joinStatements([' CREATE TABLE a (x);', '', 'CREATE INDEX i ON a (x)\n'])).toBe(
      'CREATE TABLE a (x);\nCREATE INDEX i ON a (x)',
    );
  });
});

describe('migrateRemoteD1', async () => {
  const api = await startFakeD1Api();

  afterAll(async () => {
    await api.dispose();
  });

  test("applies every migration over D1's /raw API once, then is a no-op", async () => {
    vi.stubEnv('CLOUDFLARE_ENV', 'develop');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'account');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'token');
    vi.stubGlobal('fetch', api.fetch);
    const stdout = vi.spyOn(globalThis.process.stdout, 'write').mockReturnValue(true);
    const migrations = fs
      .readdirSync(migrationsFolder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).length;

    await migrateRemoteD1();
    await migrateRemoteD1();

    const done = `Remote D1 "lightproject-database-dev" is up to date (${migrations} migration(s) applied)\n`;
    expect(stdout.mock.calls.map(([message]) => message)).toStrictEqual([
      'Migrating remote D1 "lightproject-database-dev" (develop)…\n',
      done,
      'Migrating remote D1 "lightproject-database-dev" (develop)…\n',
      done,
    ]);
    expect(api.urls.every((url) => url.includes('/accounts/account/d1/database/9f1bf2ea-'))).toBe(
      true,
    );
    await expect(
      api.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
        .raw(),
    ).resolves.toStrictEqual([['users']]);
  });
});
