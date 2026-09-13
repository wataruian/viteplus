import { apiBaseUrl } from '@lightproject/common/configs';
import type * as ServerModule from '@lightproject/common/server';
import { resetTelemetryForTests } from '@lightproject/common/server';
import type { ExecutionContext } from 'hono';
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';

import { runtimes } from './helpers/utils';

afterEach(() => {
  vi.doUnmock('@lightproject/common/server');
  vi.resetModules();
});

beforeEach(() => {
  resetTelemetryForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetTelemetryForTests();
});

describe.each(runtimes)('on $name', ({ cleanup, importApp }) => {
  afterAll(cleanup);

  test('/metrics exposes Prometheus-formatted metrics once telemetry is initialized', async () => {
    const app = await importApp();

    await app.request('/');

    const res = await app.request('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/u);

    const body = await res.text();
    expect(body).toContain('request_hits');
  });

  test('starts up when API_PORT is set', async () => {
    const app = await importApp({ API_PORT: '4321' });

    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  test('starts up when API_PORT is not set', async () => {
    const app = await importApp({ API_PORT: undefined });

    const res = await app.request('/');
    expect(res.status).toBe(200);
  });
});

test('server.fetch memoizes app creation and still serves requests correctly across calls', async () => {
  const { server } = await import('../src/app');

  const res1 = await server.fetch(new globalThis.Request(`${apiBaseUrl}/`));
  const res2 = await server.fetch(new globalThis.Request(`${apiBaseUrl}/`));

  expect(res1.status).toBe(200);
  expect(res2.status).toBe(200);
  expect(await res1.json()).toStrictEqual({ status: 'OK' });
});

test('flushes telemetry via executionCtx.waitUntil when the runtime provides one', async () => {
  const { getApp } = await import('../src/app');
  const app = await getApp();

  const waitUntilCalls: Promise<unknown>[] = [];
  const executionCtx: ExecutionContext = {
    passThroughOnException: () => {},
    waitUntil: (promise) => {
      waitUntilCalls.push(promise);
    },
  };

  const res = await app.request(`${apiBaseUrl}/`, {}, {}, executionCtx);

  expect(res.status).toBe(200);
  expect(waitUntilCalls.length).toBeGreaterThan(0);
});

test('a rejected flushTelemetry without executionCtx.waitUntil is swallowed instead of throwing', async () => {
  vi.doMock('@lightproject/common/server', async (importOriginal) => {
    const actual = await importOriginal<typeof ServerModule>();
    return {
      ...actual,
      flushTelemetry: async () => {
        await Promise.reject(new Error('flush failed'));
      },
    };
  });
  vi.resetModules();

  const { getApp } = await import('../src/app');
  const app = await getApp();

  const res = await app.request(`${apiBaseUrl}/`);
  expect(res.status).toBe(200);

  // simulate failure
  expect(true).toBe(false);

  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
});
