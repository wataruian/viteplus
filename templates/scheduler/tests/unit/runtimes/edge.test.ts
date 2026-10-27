import { logger } from '@lightproject/common/logger';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import type { EdgeContext, EdgeEnv } from '../../../src/runtimes/edge';
import { serviceName } from '../../../src/runtimes/telemetry';
import { useLocalDatabase } from '../helpers/database';

const token = 'x'.repeat(32);

const { databaseEnv, openDatabase } = useLocalDatabase();

afterEach(() => {
  vi.restoreAllMocks();
});

const edgeEnv = (): EdgeEnv => ({ ...databaseEnv(), SCHEDULER_RUN_TOKEN: token });

const edgeContext = () => {
  const pending: Promise<void>[] = [];
  const context: EdgeContext = {
    waitUntil: (promise: Promise<void>) => {
      pending.push(promise);
    },
  };
  return { context, pending };
};

const controllerFor = (cron: string) => ({
  cron,
  noRetry: () => {},
  scheduledTime: Date.parse('2026-01-01T00:05:00.000Z'),
});

describe('Worker entry (src/runtimes/edge.ts)', () => {
  test('exports only the handler', async () => {
    const entry = await import('../../../src/runtimes/edge');

    expect(Object.keys(entry)).toStrictEqual(['default']);
    expect(Object.keys(entry.default).toSorted()).toStrictEqual(['fetch', 'scheduled']);
  });

  test('a client disconnect aborts the one-off run and releases its lock', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { default: handler } = await import('../../../src/runtimes/edge');
    const { context, pending } = edgeContext();
    const client = new globalThis.AbortController();
    const request = new globalThis.Request('https://scheduler.test/run/ping', {
      body: JSON.stringify({ delayMs: 60_000 }),
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      signal: client.signal,
    });
    const database = await openDatabase();

    const responding = handler.fetch(request, edgeEnv(), context);
    const held = await vi.waitFor(
      async () => {
        const lock = await database.scriptLocks.findByName(`${serviceName}/ping`);
        if (lock === undefined) {
          throw new Error('the run has not taken its lock yet');
        }
        return lock;
      },
      { interval: 50, timeout: 10_000 },
    );
    client.abort();
    const response = await responding;
    await Promise.all(pending);

    expect(held).toMatchObject({ name: `${serviceName}/ping` });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ outcome: 'aborted', script: 'ping' });
    expect(pending).toHaveLength(1);
    await expect(database.scriptLocks.findByName(`${serviceName}/ping`)).resolves.toBeUndefined();
    await database.close();
  });

  test('a due cron runs its scripts as scheduled and releases their locks', async () => {
    const info = vi.spyOn(logger, 'info');
    const { default: handler } = await import('../../../src/runtimes/edge');
    const { context, pending } = edgeContext();

    await handler.scheduled(controllerFor('*/5 * * * *'), edgeEnv(), context);
    await Promise.all(pending);

    expect(info).toHaveBeenCalledWith('ping: pong', {
      scheduledTime: '2026-01-01T00:05:00.000Z',
      trigger: 'schedule',
    });
    const database = await openDatabase();
    await expect(database.scriptLocks.findByName(`${serviceName}/ping`)).resolves.toBeUndefined();
    await database.close();
  });

  test('a failed cron throws without asking Cloudflare to retry it', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { default: handler } = await import('../../../src/runtimes/edge');
    const { context, pending } = edgeContext();
    const controller = { ...controllerFor('*/5 * * * *'), noRetry: vi.fn<() => void>() };

    await expect(
      handler.scheduled(
        controller,
        { DATABASE_DIALECT: 'd1', SCHEDULER_RUN_TOKEN: token },
        context,
      ),
    ).rejects.toThrow('Cron */5 * * * *: ping failed');
    await Promise.all(pending);

    expect(controller.noRetry).toHaveBeenCalledOnce();
    expect(pending).toHaveLength(1);
  });

  test('a cron with no script only warns', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const { default: handler } = await import('../../../src/runtimes/edge');
    const { context } = edgeContext();

    await handler.scheduled(controllerFor('0 0 * * *'), edgeEnv(), context);

    expect(warn).toHaveBeenCalledWith(
      'Cron 0 0 * * * matches no script; check wrangler.toml [triggers]',
    );
  });

  test('a request that runs nothing still flushes telemetry once', async () => {
    const { default: handler } = await import('../../../src/runtimes/edge');
    const { context, pending } = edgeContext();

    const response = await handler.fetch(
      new globalThis.Request('https://scheduler.test/run/ping', { method: 'POST' }),
      edgeEnv(),
      context,
    );

    expect(response.status).toBe(401);
    expect(pending).toHaveLength(1);
  });
});
