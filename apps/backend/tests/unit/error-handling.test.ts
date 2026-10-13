import { logger } from '@lightproject/common/logger';
import { tracer } from '@lightproject/common/utils';
import { TRPCError } from '@trpc/server';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterAll, afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { z } from 'zod';

import { globalErrorHandler } from '../../src/middlewares/error-handler';
import { handleTrpcRequest } from '../../src/routers/trpc';
import { t } from '../../src/routers/utils';
import type { AppEnv } from '../../src/schema';
import { expectErrorEnvelope, parseErrorEnvelope, runtimes, stripVolatile } from './helpers/utils';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test('a plain (non-HTTPException) error thrown by a handler produces a generic 500 envelope', async () => {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('requestId', 'unit-test-request');
    c.set('span', tracer.startSpan('unit-test-span'));
    await next();
  });

  app.onError(globalErrorHandler);

  app.get('/boom', () => {
    throw new Error('boom');
  });

  const res = await app.request('/boom');
  expect(res.status).toBe(500);

  const parsed = await parseErrorEnvelope(res);
  expectErrorEnvelope(parsed, {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'boom',
    statusCode: 500,
  });
});

test('a plain error message is masked (and has no stack) in production', async () => {
  vi.stubEnv('ENV', 'production');
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('requestId', 'unit-test-request');
    c.set('span', tracer.startSpan('unit-test-span'));
    await next();
  });

  app.onError(globalErrorHandler);

  app.get('/secret', () => {
    throw new Error('connection refused: postgres://user:pass@db');
  });

  const res = await app.request('/secret');
  expect(res.status).toBe(500);

  const parsed = await parseErrorEnvelope(res);
  expectErrorEnvelope(parsed, {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal Server Error',
    stack: false,
    statusCode: 500,
  });
});

test.each([
  { expected: 'Internal Server Error', status: 500 },
  { expected: 'Internal Server Error', status: 502 },
  { expected: 'connect ECONNREFUSED db-internal:5432', status: 409 },
] as const)(
  'in production an HTTPException($status) message is masked only for 5xx (tRPC failures arrive this way)',
  async ({ expected, status }) => {
    vi.stubEnv('ENV', 'production');
    const app = new Hono<AppEnv>();

    app.use('*', async (c, next) => {
      c.set('requestId', 'unit-test-request');
      c.set('span', tracer.startSpan('unit-test-span'));
      await next();
    });

    app.onError(globalErrorHandler);

    app.get('/http-exception', () => {
      throw new HTTPException(status, { message: 'connect ECONNREFUSED db-internal:5432' });
    });

    const res = await app.request('/http-exception');
    expect(res.status).toBe(status);

    const parsed = await parseErrorEnvelope(res);
    expectErrorEnvelope(parsed, { code: 'HTTP_EXCEPTION', message: expected, statusCode: status });
  },
);

const batchErrorSchema = z.array(
  z.object({
    error: z.object({
      data: z.object({ httpStatus: z.number(), stack: z.string().optional() }),
      message: z.string(),
    }),
  }),
);

// Sends a batched call (the frontend's default) through the real tRPC handler to a procedure that
// throws `error`, returning the client-visible error and the server-side logger.error calls.
const callBatchedBoom = async (error: Error) => {
  const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
  const router = t.router({
    boom: t.procedure.query(() => {
      throw error;
    }),
  });
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('requestId', 'unit-test-request');
    c.set('span', tracer.startSpan('unit-test-span'));
    await next();
  });
  app.onError(globalErrorHandler);
  app.all('/trpc/*', async (c) => await handleTrpcRequest(c, router));

  const res = await app.request('/trpc/boom?batch=1&input=%7B%7D');
  const [entry] = batchErrorSchema.parse(await res.json());
  return { clientError: entry.error, loggerErrorSpy };
};

describe('tRPC errors (batched responses bypass the global error handler)', () => {
  test('in production a 5xx reaches the client masked, without a stack, and is logged with its real cause', async () => {
    vi.stubEnv('ENV', 'production');
    const cause = new Error('connect ECONNREFUSED db-internal:5432');

    const { clientError, loggerErrorSpy } = await callBatchedBoom(cause);

    expect(clientError.message).toBe('Internal Server Error');
    expect(clientError.data.httpStatus).toBe(500);
    expect(clientError.data.stack).toBeUndefined();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('connect ECONNREFUSED db-internal:5432'),
      expect.objectContaining({ err: cause, path: 'boom' }),
    );
  });

  test('a non-batched 5xx is reported once (real cause), not again by the global error handler', async () => {
    vi.stubEnv('ENV', 'production');
    const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const router = t.router({
      boom: t.procedure.query(() => {
        throw new Error('db down');
      }),
    });
    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('requestId', 'unit-test-request');
      c.set('span', tracer.startSpan('unit-test-span'));
      await next();
    });
    app.onError(globalErrorHandler);
    app.all('/trpc/*', async (c) => await handleTrpcRequest(c, router));

    const res = await app.request('/trpc/boom');

    expect(res.status).toBe(500);
    const envelope = await parseErrorEnvelope(res);
    expect(envelope.message).toBe('Internal Server Error');
    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('db down'),
      expect.objectContaining({ path: 'boom' }),
    );
  });

  test('a 5xx without a separate cause logs the tRPC error itself', async () => {
    vi.stubEnv('ENV', 'production');
    const error = new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'no cause here' });

    const { loggerErrorSpy } = await callBatchedBoom(error);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no cause here'),
      expect.objectContaining({ err: error }),
    );
  });

  test('in production a 4xx message reaches the client, without a stack, and is not error-logged', async () => {
    vi.stubEnv('ENV', 'production');

    const { clientError, loggerErrorSpy } = await callBatchedBoom(
      new TRPCError({ code: 'NOT_FOUND', message: 'No such thing' }),
    );

    expect(clientError.message).toBe('No such thing');
    expect(clientError.data.stack).toBeUndefined();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  test('locally the original message and stack reach the client', async () => {
    vi.stubEnv('ENV', 'local');

    const { clientError } = await callBatchedBoom(
      new Error('connect ECONNREFUSED db-internal:5432'),
    );

    expect(clientError.message).toBe('connect ECONNREFUSED db-internal:5432');
    expect(clientError.data.stack).toBeDefined();
  });
});

test('a plain error with an empty message falls back to a generic message', async () => {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('requestId', 'unit-test-request');
    c.set('span', tracer.startSpan('unit-test-span'));
    await next();
  });

  app.onError(globalErrorHandler);

  app.get('/blank', () => {
    const err = new Error('placeholder');
    err.message = '';
    throw err;
  });

  const res = await app.request('/blank');
  expect(res.status).toBe(500);

  const parsed = await parseErrorEnvelope(res);
  expectErrorEnvelope(parsed, {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal Server Error',
    statusCode: 500,
  });
});

describe.each(runtimes)('on $name', ({ cleanup, importApp }) => {
  afterAll(cleanup);

  test('an HTTPException thrown by shared middleware (trust-proxy) produces an identical error envelope on the HTTP and tRPC routers', async () => {
    const app = await importApp({ BLOCK_ALL_IPS: 'true' });

    const httpRes = await app.request('/api/test/hello', {});
    const trpcRes = await app.request(
      `/trpc/test.hello?input=${encodeURIComponent(JSON.stringify({}))}`,
    );

    const expectedCode = 403;

    expect(httpRes.status).toBe(expectedCode);
    expect(trpcRes.status).toBe(expectedCode);

    const parsedHttp = await parseErrorEnvelope(httpRes);
    const parsedTrpc = await parseErrorEnvelope(trpcRes);

    expectErrorEnvelope(parsedHttp, {
      code: 'HTTP_EXCEPTION',
      message: 'Access denied.',
      statusCode: expectedCode,
    });

    expect(stripVolatile(parsedTrpc)).toStrictEqual(stripVolatile(parsedHttp));
  });

  test('a malformed JSON body throws an HTTPException that flows through the global error handler on both the HTTP and tRPC routers', async () => {
    const app = await importApp();

    const httpRes = await app.request('/api/test/profile', {
      body: '{not valid json',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const trpcRes = await app.request('/trpc/test.profile', {
      body: '{not valid json',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const expectedCode = 400;

    expect(httpRes.status).toBe(expectedCode);
    expect(trpcRes.status).toBe(expectedCode);

    const parsedHttp = await parseErrorEnvelope(httpRes);
    const parsedTrpc = await parseErrorEnvelope(trpcRes);

    expectErrorEnvelope(parsedHttp, {
      code: 'HTTP_EXCEPTION',
      message: /malformed json/iu,
      stack: true,
      statusCode: expectedCode,
    });

    expectErrorEnvelope(parsedTrpc, {
      code: 'HTTP_EXCEPTION',
      message: /json/iu,
      stack: true,
      statusCode: expectedCode,
    });
  });

  test('invalid input returns error envelope on both the HTTP and tRPC routers', async () => {
    const app = await importApp();

    const httpRes = await app.request('/api/test/profile', {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const trpcRes = await app.request('/trpc/test.profile', {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const expectedCode = 400;

    expect(httpRes.status).toBe(expectedCode);
    expect(trpcRes.status).toBe(expectedCode);

    const parsedHttp = await parseErrorEnvelope(httpRes);
    const parsedTrpc = await parseErrorEnvelope(trpcRes);

    expectErrorEnvelope(parsedHttp, {
      code: 'HTTP_EXCEPTION',
      stack: true,
      statusCode: expectedCode,
    });
    expect(stripVolatile(parsedTrpc)).toStrictEqual(stripVolatile(parsedHttp));
  });

  test('an unmatched path returns error envelope on the top-level app, under /api, and on an unknown tRPC procedure', async () => {
    const app = await importApp();

    const expectedCode = 404;

    await Promise.all(
      ['/does-not-exist', '/api/does-not-exist'].map(async (path) => {
        const res = await app.request(path);
        expect(res.status).toBe(expectedCode);
        const parsed = await parseErrorEnvelope(res);
        expectErrorEnvelope(parsed, {
          code: 'NOT_FOUND',
          message: 'Not Found',
          statusCode: expectedCode,
        });
      }),
    );

    const trpcRes = await app.request('/trpc/does.not.exist');

    expect(trpcRes.status).toBe(expectedCode);

    const parsedTrpc = await parseErrorEnvelope(trpcRes);

    expectErrorEnvelope(parsedTrpc, {
      code: 'HTTP_EXCEPTION',
      message: /no procedure found/iu,
      statusCode: expectedCode,
    });
  });
});
