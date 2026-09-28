import { Hono } from 'hono';
import { afterAll, afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { getAllowedIps, getRequestIp, normalizeIp } from '../../src/middlewares/trust-proxy';
import type { AppEnv, NodeBindings } from '../../src/schema';
import { errorEnvelope, runtimes } from './helpers/utils';

const unknownIp = '9.9.9.9';
const successCode = 200;
const failureCode = 403;

afterEach(() => {
  vi.unstubAllEnvs();
});

const resolveIp = async (headers: Record<string, string>, env?: NodeBindings) => {
  const app = new Hono<AppEnv>();
  let captured = '';

  app.get('/', (c) => {
    captured = getRequestIp(c);
    return c.text('ok');
  });

  await app.request('/', { headers }, env);

  return captured;
};

const nodeSocket = (remoteAddress?: string): NodeBindings => ({
  incoming: { socket: remoteAddress === undefined ? {} : { remoteAddress } },
});

describe('normalizeIp', () => {
  test('unwraps IPv4-mapped IPv6 addresses and trims whitespace', () => {
    expect(normalizeIp(' ::ffff:127.0.0.1 ')).toBe('127.0.0.1');
    expect(normalizeIp('::FFFF:10.0.0.1')).toBe('10.0.0.1');
  });

  test('leaves plain IPv4 and IPv6 addresses untouched', () => {
    expect(normalizeIp('203.0.113.5')).toBe('203.0.113.5');
    expect(normalizeIp('::1')).toBe('::1');
    expect(normalizeIp('::ffff:abcd')).toBe('::ffff:abcd');
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

  test('always includes loopback when nothing extra is configured', () => {
    expect([...getAllowedIps()]).toStrictEqual(['127.0.0.1', '::1']);
  });
});

describe('getRequestIp on Node (socket present)', () => {
  const spoofHeaders = {
    'cf-connecting-ip': '127.0.0.1',
    'x-forwarded-for': '127.0.0.1',
    'x-real-ip': '127.0.0.1',
  };

  test('uses the socket peer and ignores client-supplied proxy headers', async () => {
    expect(await resolveIp(spoofHeaders, nodeSocket('203.0.113.5'))).toBe('203.0.113.5');
  });

  test('normalizes an IPv4-mapped socket address', async () => {
    expect(await resolveIp({}, nodeSocket('::ffff:127.0.0.1'))).toBe('127.0.0.1');
  });

  test('takes the rightmost untrusted X-Forwarded-For hop when the peer is a trusted proxy', async () => {
    vi.stubEnv('TRUSTED_PROXIES', '10.0.0.1, 10.0.0.2');

    const ip = await resolveIp(
      { 'x-forwarded-for': '127.0.0.1, 198.51.100.7, 10.0.0.2' },
      nodeSocket('::ffff:10.0.0.1'),
    );

    expect(ip).toBe('198.51.100.7');
  });

  test('falls back to the trusted proxy itself when it sends no untrusted hop', async () => {
    vi.stubEnv('TRUSTED_PROXIES', '10.0.0.1');

    expect(await resolveIp({}, nodeSocket('10.0.0.1'))).toBe('10.0.0.1');
    expect(await resolveIp({ 'x-forwarded-for': '10.0.0.1' }, nodeSocket('10.0.0.1'))).toBe(
      '10.0.0.1',
    );
  });
});

describe('getRequestIp on Workers (no socket)', () => {
  test('uses CF-Connecting-IP and ignores X-Forwarded-For', async () => {
    const ip = await resolveIp(
      { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '127.0.0.1' },
      {},
    );
    expect(ip).toBe('203.0.113.9');
  });

  test('returns an empty string when CF-Connecting-IP is absent', async () => {
    expect(await resolveIp({ 'x-forwarded-for': '127.0.0.1' })).toBe('');
    expect(await resolveIp({}, nodeSocket())).toBe('');
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
        { 'cf-connecting-ip': unknownIp },
      );
      expect(httpRes.status).toBe(successCode);
      expect(trpcRes.status).toBe(successCode);
    });

    test('CI=true is safe regardless of ENV', async () => {
      const { httpRes, trpcRes } = await requestBoth(
        { CI: 'true', ENV: 'production' },
        { 'cf-connecting-ip': unknownIp },
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
          { 'cf-connecting-ip': unknownIp },
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

  test.each(['x-forwarded-for', 'x-real-ip'])(
    'a spoofed loopback %s header does not bypass the allowlist',
    async (header) => {
      const { httpRes, trpcRes } = await requestBoth(
        { ENV: 'production' },
        { 'cf-connecting-ip': unknownIp, [header]: '127.0.0.1' },
      );
      expect(httpRes.status).toBe(failureCode);
      expect(trpcRes.status).toBe(failureCode);
    },
  );

  describe('ALLOWED_IPS', () => {
    test('a matching IP is allowed in an unsafe env', async () => {
      const { httpRes, trpcRes } = await requestBoth(
        { ALLOWED_IPS: '5.5.5.5', ENV: 'production' },
        { 'cf-connecting-ip': '5.5.5.5' },
      );
      expect(httpRes.status).toBe(successCode);
      expect(trpcRes.status).toBe(successCode);
    });

    test('a non-matching IP is still blocked in an unsafe env', async () => {
      const { httpRes, trpcRes } = await requestBoth(
        { ALLOWED_IPS: '5.5.5.5', ENV: 'production' },
        { 'cf-connecting-ip': unknownIp },
      );
      expect(httpRes.status).toBe(failureCode);
      expect(trpcRes.status).toBe(failureCode);
    });
  });

  test('ALLOW_ALL_IPS=true allows any IP regardless of env', async () => {
    const { httpRes, trpcRes } = await requestBoth(
      { ALLOW_ALL_IPS: 'true', ENV: 'production' },
      { 'cf-connecting-ip': unknownIp },
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
      { 'cf-connecting-ip': unknownIp },
    );
    expect(httpRes.status).toBe(failureCode);
    expect(trpcRes.status).toBe(failureCode);
  });
});
