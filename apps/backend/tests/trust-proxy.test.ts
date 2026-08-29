import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { errorEnvelope, importFreshApp } from './helpers/fresh-app';

const unknownIp = '9.9.9.9';
const successCode = 200;
const failureCode = 403;

afterEach(() => {
  vi.unstubAllEnvs();
});

const requestBoth = async (
  env: Record<string, string> = {},
  headers: Record<string, string> = {},
) => {
  const app = await importFreshApp(env);
  const httpRes = await app.request('/api/test/hello', { headers });
  const trpcRes = await app.request(
    `/trpc/test.hello?input=${encodeURIComponent(JSON.stringify({}))}`,
    { headers },
  );
  return { httpRes, trpcRes };
};

describe('safe environments allow requests without any IP allowlisting', () => {
  test.each(['local', 'test', 'qa-random-unrecognized'])('ENV=%s is safe', async (env) => {
    const { httpRes, trpcRes } = await requestBoth({ ENV: env }, { 'x-forwarded-for': unknownIp });
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
