import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

import { parse as parseToml } from 'smol-toml';
import { z } from 'zod';

const packageDir = globalThis.process.cwd();
const rootEnvFile = path.resolve(packageDir, '../../.env');
const wranglerConfig = path.join(packageDir, 'wrangler.toml');

const wranglerSchema = z.object({
  env: z
    .record(
      z.string(),
      z.object({
        d1_databases: z
          .array(
            z.object({
              binding: z.string(),
              database_id: z.string().optional(),
              database_name: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

interface RemoteD1 {
  accountId: string;
  cloudflareEnv: string;
  databaseId: string;
  databaseName: string;
  token: string;
}

interface RemoteD1Files {
  envFile?: string;
  wranglerConfig?: string;
}

const resolveRemoteD1 = (
  env: NodeJS.ProcessEnv = globalThis.process.env,
  files: RemoteD1Files = {},
): RemoteD1 => {
  const { envFile = rootEnvFile, wranglerConfig: configPath = wranglerConfig } = files;
  const cloudflareEnv = env['CLOUDFLARE_ENV'];
  if (cloudflareEnv === undefined || cloudflareEnv === '') {
    throw new Error(
      'Set CLOUDFLARE_ENV to the D1 environment to migrate, e.g. `DATABASE_DIALECT=d1 CLOUDFLARE_ENV=develop vpr db:migrate`',
    );
  }

  const wrangler = wranglerSchema.parse(parseToml(fs.readFileSync(configPath, 'utf8')));
  const environments = new Map(Object.entries(wrangler.env ?? {}));
  const environment = environments.get(cloudflareEnv);
  if (!environment) {
    throw new Error(
      `wrangler.toml has no [env.${cloudflareEnv}]; known: ${[...environments.keys()].join(', ')}`,
    );
  }
  const database = environment.d1_databases?.find(({ binding }) => binding === 'DB');
  const databaseName = database?.database_name ?? `lightproject-${cloudflareEnv}`;
  if (database?.database_id === undefined || database.database_id === '') {
    throw new Error(
      `wrangler.toml has no D1 database id for "${cloudflareEnv}": run \`vp exec wrangler d1 create ${databaseName}\` and paste its id`,
    );
  }

  const dotenv = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
  const credential = (key: string) => {
    const value = env[key] ?? dotenv[key];
    if (value === undefined || value === '') {
      throw new Error(`${key} is required to migrate a remote D1 (set it in the root .env)`);
    }
    return value;
  };

  return {
    accountId: credential('CLOUDFLARE_ACCOUNT_ID'),
    cloudflareEnv,
    databaseId: database.database_id,
    databaseName,
    token: credential('CLOUDFLARE_API_TOKEN'),
  };
};

const rawResponseSchema = z.object({
  errors: z.array(z.object({ message: z.string() })).default([]),
  result: z
    .array(z.object({ results: z.object({ rows: z.array(z.array(z.json())).default([]) }) }))
    .default([]),
  success: z.boolean(),
});

const createRemoteD1Query =
  ({ accountId, databaseId, token }: RemoteD1) =>
  async (sql: string, params: readonly unknown[] = []) => {
    const response = await globalThis.fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/raw`,
      {
        body: JSON.stringify({ params, sql }),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        method: 'POST',
      },
    );
    const body = rawResponseSchema.parse(await response.json());
    if (!response.ok || !body.success) {
      const reason = body.errors.map(({ message }) => message).join('; ');
      throw new Error(`D1 query failed (HTTP ${response.status}): ${reason || 'unknown error'}`);
    }
    return body.result.at(-1)?.results.rows ?? [];
  };

export {
  createRemoteD1Query,
  packageDir,
  rawResponseSchema,
  resolveRemoteD1,
  rootEnvFile,
  wranglerConfig,
  wranglerSchema,
};
export type { RemoteD1, RemoteD1Files };
