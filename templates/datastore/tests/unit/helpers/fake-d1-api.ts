import path from 'node:path';

import { getPlatformProxy } from 'wrangler';
import { z } from 'zod';

import type { D1Binding } from '../../../src/d1/client';

const packageDir = path.resolve(import.meta.dirname, '../../..');

const rawRequestSchema = z.object({ params: z.array(z.json()), sql: z.string() });

const startFakeD1Api = async () => {
  const proxy = await getPlatformProxy<{ DB: D1Binding }>({
    configPath: path.join(packageDir, 'wrangler.toml'),
    persist: false,
  });
  const urls: string[] = [];

  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    urls.push(input instanceof globalThis.Request ? input.url : input.toString());
    const body = typeof init?.body === 'string' ? init.body : '';
    const { params, sql } = rawRequestSchema.parse(JSON.parse(body));
    const statements = sql.split(';\n');
    try {
      const results = await proxy.env.DB.batch<Record<string, string | number | null>>(
        statements.map((statement) =>
          proxy.env.DB.prepare(statement).bind(...(statements.length === 1 ? params : [])),
        ),
      );
      const result = results.map(({ results: rows }) => ({
        results: { rows: rows.map((row) => Object.values(row)) },
      }));
      return globalThis.Response.json({ errors: [], result, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      return globalThis.Response.json({ errors: [{ message }], success: false }, { status: 400 });
    }
  };

  return { db: proxy.env.DB, dispose: proxy.dispose, fetch, urls };
};

export { startFakeD1Api };
