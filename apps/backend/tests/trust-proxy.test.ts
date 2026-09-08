import { Hono } from 'hono';
import { afterAll, afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { getAllowedIps, getRequestIp, isNodeEnv } from '../src/middlewares/trust-proxy';
import { errorEnvelope, runtimes } from './helpers/utils';

const unknownIp = '9.9.9.9';
const successCode = 200;
const failureCode = 403;

afterEach(() => {
  vi.unstubAllEnvs();
});

const requestWithEnv = async (env: Record<string, unknown>) => {
  const app = new Hono();
  let captured = '';

  app.get('/', (c) => {
    captured = getRequestIp(c);
    return c.text('ok');
  });

  await app.request('/', {}, env);

  return captured;
};

describe('isNodeEnv', () => {
  test('accepts any non-null object', () => {
    expect(isNodeEnv({})).toBe(true);
    expect(isNodeEnv({ incoming: { socket: {} } })).toBe(true);
  });

  test('rejects primitives, null, and undefined', () => {
    expect(isNodeEnv(null)).toBe(false);
    expect(isNodeEnv(undefined)).toBe(false);
    expect(isNodeEnv('string')).toBe(false);
    expect(isNodeEnv(42)).toBe(false);
  });
});

describe('getAllowedIps', () => {
  test('skips whitespace-only entries produced by stray commas', () => {
    const allowed = getAllowedIps('5.5.5.5, ,,6.6.6.6');

    expect(allowed.has('5.5.5.5')).toBe(true);
    expect(allowed.has('6.6.6.6')).toBe(true);
    expect(allowed.has('')).toBe(false);
    expect(allowed.size).toBe(4);
  });
});

describe('getRequestIp', () => {
  test('falls back to env.incoming.socket.remoteAddress when no proxy headers are present', async () => {
    const ip = await requestWithEnv({ incoming: { socket: { remoteAddress: '203.0.113.5' } } });
    expect(ip).toBe('203.0.113.5');
  });

  test('returns an empty string when neither proxy headers nor a Node env are present', async () => {
    const ip = await requestWithEnv({});
    expect(ip).toBe('');
  });

  test('ignores a non-string remoteAddress', async () => {
    const ip = await requestWithEnv({ incoming: { socket: { remoteAddress: 12_345 } } });
    expect(ip).toBe('');
  });
});

describe.each(runtimes)('on $name', ({ cleanup, importApp }) => {
  afterAll(cleanup);

  const requestBoth = async (
    env: Record<string, string> = {},
    headers: Record<string, string> = {},
  ) => {
    const app = await importApp(env);
    const httpRes = await app.request('/api/test/hello', { headers });
    const trpcRes = await app.request(
      `/trpc/test.hello?input=${encodeURIComponent(JSON.stringify({}))}`,
      { headers },
    );
    return { httpRes, trpcRes };
  };

  describe('safe environments allow requests without any IP allowlisting', () => {
    test.each(['local', 'test', 'qa-random-unrecognized'])('ENV=%s is safe', async (env) => {
      const { httpRes, trpcRes } = await requestBoth(
        { ENV: env },
        { 'x-forwarded-for': unknownIp },
      );
      expect(httpRes.status).toBe(successCode);
      expect(trpcRes.status).toBe(successCode);
    });

    test('CI=true is safe regardless of ENV', async () => {
      const { httpRes, trpcRes } = await requestBoth(
        { CI: 'true', ENV: 'production' },
        { 'x-forwarded-for': unknownIp },
      );
      expect(httpRes.status).toBe(successCode);
      expect(trpcRes.status).toBe(successCode);
    });
  });

  describe('develop/staging/production are NOT auto-safe', () => {
    test.each(['develop', 'staging', 'production'])(
      'ENV=%s blocks an unallowlisted IP',
      async (env) => {
        const { httpRes, trpcRes } = await requestBoth(
          { ENV: env },
          { 'x-forwarded-for': unknownIp },
        );

        expect(httpRes.status).toBe(failureCode);
        expect(trpcRes.status).toBe(failureCode);

        const body: unknown = await httpRes.json();
        const parsed = errorEnvelope.parse(body);
        expect(parsed.error.code).toBe('HTTP_EXCEPTION');
        expect(parsed.message).toBe('Access denied.');
      },
    );
  });

  describe('ALLOWED_IPS', () => {
    test('a matching IP is allowed in an unsafe env', async () => {
      const { httpRes, trpcRes } = await requestBoth(
        { ALLOWED_IPS: '5.5.5.5', ENV: 'production' },
        { 'x-forwarded-for': '5.5.5.5' },
      );
      expect(httpRes.status).toBe(successCode);
      expect(trpcRes.status).toBe(successCode);
    });

    test('a non-matching IP is still blocked in an unsafe env', async () => {
      const { httpRes, trpcRes } = await requestBoth(
        { ALLOWED_IPS: '5.5.5.5', ENV: 'production' },
        { 'x-forwarded-for': unknownIp },
      );
      expect(httpRes.status).toBe(failureCode);
      expect(trpcRes.status).toBe(failureCode);
    });
  });

  test('ALLOW_ALL_IPS=true allows any IP regardless of env', async () => {
    const { httpRes, trpcRes } = await requestBoth(
      { ALLOW_ALL_IPS: 'true', ENV: 'production' },
      { 'x-forwarded-for': unknownIp },
    );
    expect(httpRes.status).toBe(successCode);
    expect(trpcRes.status).toBe(successCode);
  });

  test('BLOCK_ALL_IPS=true blocks every request even in an otherwise-safe env', async () => {
    const { httpRes, trpcRes } = await requestBoth({ BLOCK_ALL_IPS: 'true', ENV: 'local' });
    expect(httpRes.status).toBe(failureCode);
    expect(trpcRes.status).toBe(failureCode);
  });

  test('BLOCK_ALL_IPS=true wins over ALLOW_ALL_IPS=true', async () => {
    const { httpRes, trpcRes } = await requestBoth(
      { ALLOW_ALL_IPS: 'true', BLOCK_ALL_IPS: 'true', ENV: 'production' },
      { 'x-forwarded-for': unknownIp },
    );
    expect(httpRes.status).toBe(failureCode);
    expect(trpcRes.status).toBe(failureCode);
  });
});
