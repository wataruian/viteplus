import path from 'node:path';

import { z } from '@hono/zod-openapi';
import { expect, vi } from 'vite-plus/test';
import { type Unstable_DevWorker, unstable_dev } from 'wrangler';

import { createWrappedResponseSchema } from '../../src/routers/utils';

type ParsedErrorEnvelope = z.infer<typeof errorEnvelope>;

interface FetchResponseLike {
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
  status: number;
}

const errorEnvelope = z.object({
  code: z.number(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    statusCode: z.number(),
  }),
  message: z.string(),
  sessionId: z.string(),
  success: z.literal(false),
});

const httpEnvelope = createWrappedResponseSchema;

const trpcEnvelope = <T extends z.ZodType>(dataSchema: T) =>
  z.object({ result: z.object({ data: createWrappedResponseSchema(dataSchema) }) });

const stripVolatile = (parsed: ParsedErrorEnvelope) => ({
  ...parsed,
  error: { ...parsed.error, stack: undefined },
  sessionId: 'x',
});

const parseErrorEnvelope = async (res: FetchResponseLike) => errorEnvelope.parse(await res.json());

const expectErrorEnvelope = (
  parsed: ParsedErrorEnvelope,
  expected: { code: string; message?: RegExp | string; stack?: boolean; statusCode: number },
) => {
  expect(parsed.code).toBe(expected.statusCode);
  expect(parsed.error.code).toBe(expected.code);
  expect(parsed.error.statusCode).toBe(expected.statusCode);
  expect(parsed.message).toBe(parsed.error.message);
  expect(parsed.sessionId).toBeDefined();
  expect(parsed.success).toBe(false);

  if (expected.message !== undefined) {
    if (typeof expected.message === 'string') {
      expect(parsed.message).toBe(expected.message);
    } else {
      expect(parsed.message).toMatch(expected.message);
    }
  }

  if (expected.stack !== undefined) {
    if (expected.stack) {
      expect(parsed.error.stack).toBeDefined();
    } else {
      expect(parsed.error.stack).toBeUndefined();
    }
  }
};

const importFreshApp = async (env: Record<string, string | undefined> = {}) => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('CI', undefined);
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  const { getApp } = await import('../../src/app');
  return getApp();
};

const wranglerEntryPath = path.resolve(import.meta.dirname, '../../src/runtimes/edge.ts');
const wranglerConfigPath = path.resolve(import.meta.dirname, '../../wrangler.toml');

const maxConcurrentWranglerWorkers = 4;

const wranglerWorkers = new Map<string, Promise<Unstable_DevWorker>>();

const wranglerEnvKey = (env: Record<string, string>) =>
  JSON.stringify(Object.entries(env).toSorted(([a], [b]) => a.localeCompare(b)));

const definedEntries = (env: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

const stopWranglerWorker = async (workerPromise: Promise<Unstable_DevWorker>) => {
  const worker = await workerPromise;
  await worker.stop();
};

const importFreshWranglerApp = async (
  env: Record<string, string | undefined> = {},
): Promise<{ request: Unstable_DevWorker['fetch'] }> => {
  const definedEnv = definedEntries(env);
  const key = wranglerEnvKey(definedEnv);
  const cached = wranglerWorkers.get(key);
  if (cached) {
    wranglerWorkers.delete(key);
    wranglerWorkers.set(key, cached);
    const worker = await cached;
    return { request: worker.fetch };
  }

  if (wranglerWorkers.size >= maxConcurrentWranglerWorkers) {
    const oldestKey = wranglerWorkers.keys().next().value;
    if (oldestKey !== undefined) {
      const oldestWorkerPromise = wranglerWorkers.get(oldestKey);
      wranglerWorkers.delete(oldestKey);
      if (oldestWorkerPromise) {
        await stopWranglerWorker(oldestWorkerPromise);
      }
    }
  }

  const workerPromise = unstable_dev(wranglerEntryPath, {
    config: wranglerConfigPath,
    experimental: { disableExperimentalWarning: true },
    ip: '127.0.0.1',
    local: true,
    logLevel: 'none',
    persist: false,
    vars: definedEnv,
  });
  wranglerWorkers.set(key, workerPromise);
  const worker = await workerPromise;
  return { request: worker.fetch };
};

const stopAllWranglerWorkers = async () => {
  const pending = [...wranglerWorkers.values()];
  wranglerWorkers.clear();
  await Promise.all(
    pending.map(async (workerPromise) => {
      await stopWranglerWorker(workerPromise);
    }),
  );
};

const noopCleanup = async () => {};

const runtimes = [
  { cleanup: noopCleanup, importApp: importFreshApp, name: 'node' },
  { cleanup: stopAllWranglerWorkers, importApp: importFreshWranglerApp, name: 'wrangler' },
] as const;

export {
  definedEntries,
  errorEnvelope,
  expectErrorEnvelope,
  httpEnvelope,
  importFreshApp,
  importFreshWranglerApp,
  maxConcurrentWranglerWorkers,
  noopCleanup,
  parseErrorEnvelope,
  runtimes,
  stopAllWranglerWorkers,
  stopWranglerWorker,
  stripVolatile,
  trpcEnvelope,
  wranglerConfigPath,
  wranglerEntryPath,
  wranglerEnvKey,
  wranglerWorkers,
};
export type { FetchResponseLike, ParsedErrorEnvelope };
