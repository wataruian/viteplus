import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test, vi } from 'vite-plus/test';

import {
  type RemoteD1,
  createRemoteD1Query,
  wranglerConfig as defaultWranglerConfig,
  resolveRemoteD1,
  rootEnvFile,
} from '../../src/scripts/remote-d1';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-d1-'));
const wranglerConfig = path.join(scratch, 'wrangler.toml');
const envFile = path.join(scratch, '.env');
const missingEnvFile = path.join(scratch, 'missing.env');

fs.writeFileSync(
  wranglerConfig,
  [
    '[[env.develop.d1_databases]]',
    'binding = "DB"',
    'database_name = "named-dev"',
    'database_id = "dev-id"',
    '',
    '[[env.staging.d1_databases]]',
    'binding = "DB"',
    'database_id = "staging-id"',
    '',
    '[[env.production.d1_databases]]',
    'binding = "DB"',
    '',
    '[env.empty]',
  ].join('\n'),
);
fs.writeFileSync(
  envFile,
  'CLOUDFLARE_ACCOUNT_ID="file-account"\nCLOUDFLARE_API_TOKEN="file-token"\n',
);

const credentials = { CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_API_TOKEN: 'token' };
const remote: RemoteD1 = {
  accountId: 'account',
  cloudflareEnv: 'develop',
  databaseId: 'dev-id',
  databaseName: 'named-dev',
  token: 'token',
};

afterAll(() => {
  fs.rmSync(scratch, { force: true, recursive: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveRemoteD1', () => {
  test("defaults to the package wrangler.toml and the repository's root .env", () => {
    expect(defaultWranglerConfig).toBe(path.join(globalThis.process.cwd(), 'wrangler.toml'));
    expect(rootEnvFile).toBe(path.resolve(globalThis.process.cwd(), '../../.env'));
    expect(
      resolveRemoteD1({ ...credentials, CLOUDFLARE_ENV: 'develop' }, { envFile: missingEnvFile })
        .databaseName,
    ).toBe('lightproject-database-dev');
  });

  test('reads the DB binding of [env.<CLOUDFLARE_ENV>] and credentials from the environment', () => {
    expect(
      resolveRemoteD1(
        { ...credentials, CLOUDFLARE_ENV: 'develop' },
        { envFile: missingEnvFile, wranglerConfig },
      ),
    ).toStrictEqual(remote);
  });

  test('defaults the database name and falls back to the env file for credentials', () => {
    expect(
      resolveRemoteD1({ CLOUDFLARE_ENV: 'staging' }, { envFile, wranglerConfig }),
    ).toStrictEqual({
      accountId: 'file-account',
      cloudflareEnv: 'staging',
      databaseId: 'staging-id',
      databaseName: 'lightproject-staging',
      token: 'file-token',
    });
  });

  test.each([
    [{}, /Set CLOUDFLARE_ENV/u],
    [{ CLOUDFLARE_ENV: '' }, /Set CLOUDFLARE_ENV/u],
    [{ CLOUDFLARE_ENV: 'nope' }, /no \[env\.nope\]; known: develop, staging, production, empty/u],
    [{ CLOUDFLARE_ENV: 'production' }, /no D1 database id for "production"/u],
    [{ CLOUDFLARE_ENV: 'empty' }, /d1 create lightproject-empty/u],
    [{ CLOUDFLARE_ENV: 'develop' }, /CLOUDFLARE_ACCOUNT_ID is required/u],
    [
      { CLOUDFLARE_ACCOUNT_ID: '', CLOUDFLARE_ENV: 'develop' },
      /CLOUDFLARE_ACCOUNT_ID is required/u,
    ],
  ])('rejects %o', (env, message) => {
    expect(() => resolveRemoteD1(env, { envFile: missingEnvFile, wranglerConfig })).toThrow(
      message,
    );
  });

  test('rejects a wrangler.toml without any [env.*]', () => {
    const bare = path.join(scratch, 'bare.toml');
    fs.writeFileSync(bare, 'name = "bare"\n');

    expect(() =>
      resolveRemoteD1(
        { CLOUDFLARE_ENV: 'develop' },
        { envFile: missingEnvFile, wranglerConfig: bare },
      ),
    ).toThrow(/known: $/u);
  });
});

const respond = (status: number, body: object) => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => await Promise.resolve(globalThis.Response.json(body, { status })),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

describe('createRemoteD1Query', () => {
  test("posts to the database's /raw endpoint and returns the last result's rows", async () => {
    const fetch = respond(200, {
      result: [{ results: { rows: [[1]] } }, { results: { rows: [['a', 2]] } }],
      success: true,
    });

    await expect(createRemoteD1Query(remote)('SELECT ?', ['x'])).resolves.toStrictEqual([['a', 2]]);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/account/d1/database/dev-id/raw',
    );
    expect(init).toMatchObject({
      body: JSON.stringify({ params: ['x'], sql: 'SELECT ?' }),
      headers: { Authorization: 'Bearer token' },
      method: 'POST',
    });
  });

  test('sends no params by default and returns no rows for an empty result', async () => {
    const fetch = respond(200, { success: true });

    await expect(createRemoteD1Query(remote)('SELECT 1')).resolves.toStrictEqual([]);
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ params: [], sql: 'SELECT 1' }));
  });

  test.each([
    [
      400,
      { errors: [{ message: 'bad' }, { message: 'worse' }], success: false },
      'HTTP 400): bad; worse',
    ],
    [500, { success: true }, 'HTTP 500): unknown error'],
    [200, { success: false }, 'HTTP 200): unknown error'],
  ])('throws on HTTP %i / %o', async (status, body, message) => {
    respond(status, body);

    await expect(createRemoteD1Query(remote)('SELECT 1')).rejects.toThrow(message);
  });
});
