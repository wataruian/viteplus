import { afterAll, afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { expectErrorEnvelope, parseErrorEnvelope, runtimes, stripVolatile } from './helpers/utils';

afterEach(() => {
  vi.unstubAllEnvs();
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
