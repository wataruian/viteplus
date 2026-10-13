import { logger } from '@lightproject/common/logger';
import type * as UtilsModule from '@lightproject/common/utils';
import { type SpanStatus, SpanStatusCode, tracer } from '@lightproject/common/utils';
import { type ErrorHandler, Hono } from 'hono';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import type { AppEnv } from '../../src/schema';

const { recordGaugeWithExemplarMock } = vi.hoisted(() => ({
  recordGaugeWithExemplarMock: vi.fn<typeof UtilsModule.recordGaugeWithExemplar>(),
}));

vi.mock('@lightproject/common/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof UtilsModule>()),
  recordGaugeWithExemplar: recordGaugeWithExemplarMock,
}));

const { requestLogger } = await import('../../src/middlewares/logger');

describe('requestLogger', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  test.each([
    { failed: true, path: '/boom', status: 500 },
    { failed: false, path: '/ping', status: 200 },
  ])(
    'marks the request span as an error only for 5xx ($status)',
    async ({ failed, path, status }) => {
      recordGaugeWithExemplarMock.mockResolvedValue(undefined);
      const realStartSpan = tracer.startSpan.bind(tracer);
      const setStatusCalls: SpanStatus[] = [];
      vi.spyOn(tracer, 'startSpan').mockImplementation((...args) => {
        const span = realStartSpan(...args);
        const originalSetStatus = span.setStatus.bind(span);
        span.setStatus = (spanStatus) => {
          setStatusCalls.push(spanStatus);
          return originalSetStatus(spanStatus);
        };
        return span;
      });

      const app = new Hono<AppEnv>();
      app.use('*', requestLogger());
      app.get('/ping', (c) => c.text('pong'));
      app.get('/boom', (c) => c.text('down', 500));

      const res = await app.request(path);

      expect(res.status).toBe(status);
      expect(setStatusCalls).toStrictEqual(failed ? [{ code: SpanStatusCode.ERROR }] : []);
    },
  );

  test.each([
    { expected: 'error handler broke', thrown: new Error('error handler broke') },
    { expected: 'non-error thrown', thrown: 'non-error thrown' },
  ])(
    'ends the span as an error, records the exception and the duration when the downstream chain throws ($expected)',
    async ({ expected, thrown }) => {
      recordGaugeWithExemplarMock.mockResolvedValue(undefined);
      const realStartSpan = tracer.startSpan.bind(tracer);
      const setStatusCalls: SpanStatus[] = [];
      let ended = false;
      const recordedExceptions: string[] = [];
      const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.spyOn(tracer, 'startSpan').mockImplementation((...args) => {
        const span = realStartSpan(...args);
        const originalSetStatus = span.setStatus.bind(span);
        const originalEnd = span.end.bind(span);
        const originalRecordException = span.recordException.bind(span);
        span.recordException = (exception, time) => {
          recordedExceptions.push(
            typeof exception === 'string' ? exception : (exception.message ?? ''),
          );
          originalRecordException(exception, time);
        };
        span.setStatus = (spanStatus) => {
          setStatusCalls.push(spanStatus);
          return originalSetStatus(spanStatus);
        };
        span.end = (endTime) => {
          ended = true;
          originalEnd(endTime);
        };
        return span;
      });

      const app = new Hono<AppEnv>();
      app.use('*', requestLogger());
      app.get('/boom', () => {
        throw new Error('route failed');
      });
      app.onError(vi.fn<ErrorHandler<AppEnv>>().mockRejectedValue(thrown));

      await expect(app.request('/boom')).rejects.toBe(thrown);

      expect(ended).toBe(true);
      expect(setStatusCalls).toStrictEqual([{ code: SpanStatusCode.ERROR }]);
      expect(recordedExceptions).toStrictEqual([expected]);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Unhandled error: [GET] http://localhost/boom',
        expect.objectContaining({ path: '/boom' }),
      );
      const [gaugeOptions] = recordGaugeWithExemplarMock.mock.calls.at(-1) ?? [];
      expect(gaugeOptions?.attributes?.['http.response.status_code']).toBe(500);
    },
  );

  test('redacts sensitive query values from the logged and traced URL', async () => {
    recordGaugeWithExemplarMock.mockResolvedValue(undefined);
    const loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const startSpanSpy = vi.spyOn(tracer, 'startSpan');

    const app = new Hono<AppEnv>();
    app.use('*', requestLogger());
    app.get('/callback', (c) => c.text('ok'));

    await app.request('http://localhost/callback?access_token=secret-value&page=2');

    const loggedMessages = loggerInfoSpy.mock.calls.map(([message]) => message).join('\n');
    expect(loggedMessages).toContain('access_token=REDACTED');
    expect(loggedMessages).not.toContain('secret-value');
    const [, spanOptions] = startSpanSpy.mock.calls[0] ?? [];
    expect(spanOptions?.attributes?.['url.full']).toBe(
      'http://localhost/callback?access_token=REDACTED&page=2',
    );
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
