import type { recordGaugeWithExemplar } from '@lightproject/common/server';
import { Hono } from 'hono';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import type { AppEnv } from '../src/schema';

const { recordGaugeWithExemplarMock } = vi.hoisted(() => ({
  recordGaugeWithExemplarMock: vi.fn<typeof recordGaugeWithExemplar>(),
}));

vi.mock('@lightproject/common/server', () => ({
  recordGaugeWithExemplar: recordGaugeWithExemplarMock,
}));

const { requestLogger } = await import('../src/middlewares/logger');

describe('requestLogger', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('still responds successfully when recording the exemplar metric fails', async () => {
    recordGaugeWithExemplarMock.mockRejectedValue(new Error('otlp unreachable'));

    const app = new Hono<AppEnv>();
    app.use('*', requestLogger());
    app.get('/ping', (c) => c.text('pong'));

    const res = await app.request('/ping');

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('pong');
    expect(recordGaugeWithExemplarMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'http_server_duration_seconds' }),
    );
  });

  test('labels the exemplar metric with the matched route pattern, not the literal request path', async () => {
    recordGaugeWithExemplarMock.mockResolvedValue(undefined);

    const app = new Hono<AppEnv>();
    app.use('*', requestLogger());
    app.get('/users/:id', (c) => c.text('ok'));

    await app.request('/users/123');

    const [[options]] = recordGaugeWithExemplarMock.mock.calls;
    expect(options.attributes).toMatchObject({ 'http.route': '/users/:id' });
  });

  test('labels the exemplar metric with a single bounded route for unmatched requests, instead of the literal 404 path', async () => {
    recordGaugeWithExemplarMock.mockResolvedValue(undefined);

    const app = new Hono<AppEnv>();
    app.use('*', requestLogger());

    await app.request('/totally/made/up/path');

    const [[options]] = recordGaugeWithExemplarMock.mock.calls;
    expect(options.attributes).toMatchObject({ 'http.route': '/*' });
  });
});
