import { apiBaseUrl } from '@lightproject/common/configs';
import type * as ServerModule from '@lightproject/common/server';
import { resetTelemetryForTests } from '@lightproject/common/server';
import { startFakeOtelCollector } from '@lightproject/common/testing';
import type { ExecutionContext } from 'hono';
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

import { importFreshApp, parseErrorEnvelope, runtimes } from './helpers/utils';

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
    const collector = await startFakeOtelCollector();
    try {
      const app = await importApp({
        OTEL_EXPORTER_OTLP_ENDPOINT: collector.url,
        SKIP_OPENTELEMETRY: 'false',
      });

      await app.request('/');

      const res = await app.request('/metrics');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/text\/plain/u);

      const body = await res.text();
      expect(body).toContain('request_hits');
    } finally {
      await collector.close();
    }
  });

  test('SKIP_OPENTELEMETRY=true starts without telemetry (/metrics reports it uninitialized)', async () => {
    const app = await importApp({ SKIP_OPENTELEMETRY: 'true' });

    const res = await app.request('/metrics');

    expect(res.status).toBe(503);
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
  const { server } = await import('../../src/app');

  const res1 = await server.fetch(new globalThis.Request(`${apiBaseUrl}/`));
  const res2 = await server.fetch(new globalThis.Request(`${apiBaseUrl}/`));

  expect(res1.status).toBe(200);
  expect(res2.status).toBe(200);
  expect(await res1.json()).toStrictEqual({ status: 'OK' });
});

test('flushes telemetry via executionCtx.waitUntil when the runtime provides one', async () => {
  const { getApp } = await import('../../src/app');
  const app = await getApp();

  const waitUntilCalls: Promise<unknown>[] = [];
  const executionCtx: ExecutionContext = {
    passThroughOnException: () => {},
    props: {},
    waitUntil: (promise) => {
      waitUntilCalls.push(promise);
    },
  };

  const res = await app.request(`${apiBaseUrl}/`, {}, {}, executionCtx);

  expect(res.status).toBe(200);
  expect(waitUntilCalls.length).toBeGreaterThan(0);
});

test('does not force-flush telemetry per request when the runtime has no executionCtx.waitUntil', async () => {
  const flushTelemetry = vi.fn(async () => {});
  vi.doMock('@lightproject/common/server', async (importOriginal) => {
    const actual = await importOriginal<typeof ServerModule>();
    return { ...actual, flushTelemetry };
  });
  vi.resetModules();

  const { getApp } = await import('../../src/app');
  const app = await getApp();

  const res = await app.request(`${apiBaseUrl}/`);
  expect(res.status).toBe(200);
  expect(flushTelemetry).not.toHaveBeenCalled();
});

test('an extremely deep JSON query param still gets a normal response (no bare 500)', async () => {
  const { getApp } = await import('../../src/app');
  const app = await getApp();
  const deep = `${'['.repeat(7000)}${']'.repeat(7000)}`;

  const res = await app.request(`${apiBaseUrl}/trpc/test.hello?input=${encodeURIComponent(deep)}`);

  expect(res.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/u);
  expect(res.status).toBeLessThan(500);
});

test('every response carries the request id in X-Request-Id', async () => {
  const { getApp } = await import('../../src/app');
  const app = await getApp();

  const res = await app.request(`${apiBaseUrl}/api/does-not-exist`);
  const envelope = await parseErrorEnvelope(res);

  expect(res.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/u);
  expect(envelope.requestId).toBe(res.headers.get('X-Request-Id'));
});

test.each(['/metrics', '/trpc/default.root'])(
  'X-Request-Id is also set on routes that return a raw Response (%s)',
  async (route) => {
    const { getApp } = await import('../../src/app');
    const app = await getApp();

    const res = await app.request(`${apiBaseUrl}${route}`);

    expect(res.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/u);
  },
);

const logLineSchema = z.object({ message: z.string(), requestId: z.string().optional() });

test('with SKIP_OPENTELEMETRY=true, request logs still carry the response’s X-Request-Id', async () => {
  const logSpy = vi.spyOn(globalThis.console, 'log').mockImplementation(() => {});
  try {
    const app = await importFreshApp({
      LOG_FORMAT: 'json',
      LOG_LEVEL: 'info',
      SKIP_OPENTELEMETRY: 'true',
    });

    const res = await app.request(`${apiBaseUrl}/`);

    const requestLogs = logSpy.mock.calls
      .map(([line]) => logLineSchema.parse(JSON.parse(String(line))))
      .filter(({ message }) => /^(?:Incoming Request|Outgoing Response):/u.test(message));
    expect(requestLogs).toHaveLength(2);
    expect(requestLogs.map(({ requestId }) => requestId)).toStrictEqual([
      res.headers.get('X-Request-Id'),
      res.headers.get('X-Request-Id'),
    ]);
  } finally {
    logSpy.mockRestore();
  }
});
