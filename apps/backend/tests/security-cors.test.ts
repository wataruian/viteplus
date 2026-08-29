import { apiBaseUrl } from '@lightproject/common/configs';
import { afterEach, expect, test, vi } from 'vite-plus/test';

import { importFreshApp } from './helpers/fresh-app';

const allowedOrigin = apiBaseUrl;
const disallowedOrigin = 'https://example.com';

afterEach(() => {
  vi.unstubAllEnvs();
});

test('an allowed origin is echoed back on both the HTTP and tRPC routers', async () => {
  const app = await importFreshApp();

  const expectedCode = 200;

  const httpRes = await app.request('/api/test/hello', { headers: { Origin: allowedOrigin } });
  const trpcRes = await app.request(
    `/trpc/test.hello?input=${encodeURIComponent(JSON.stringify({}))}`,
    { headers: { Origin: allowedOrigin } },
  );

  expect(httpRes.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
  expect(trpcRes.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
  expect(httpRes.status).toBe(expectedCode);
  expect(trpcRes.status).toBe(expectedCode);
});

test('a disallowed origin gets no Access-Control-Allow-Origin header, but the request still succeeds', async () => {
  const app = await importFreshApp();

  const expectedCode = 200;

  const httpRes = await app.request('/api/test/hello', {
    headers: { Origin: disallowedOrigin },
  });
  const trpcRes = await app.request(
    `/trpc/test.hello?input=${encodeURIComponent(JSON.stringify({}))}`,
    { headers: { Origin: disallowedOrigin } },
  );

  expect(httpRes.headers.get('access-control-allow-origin')).toBeNull();
  expect(trpcRes.headers.get('access-control-allow-origin')).toBeNull();

  expect(httpRes.status).toBe(expectedCode);
  expect(trpcRes.status).toBe(expectedCode);
  const httpBody: unknown = await httpRes.json();
  expect(httpBody).toMatchObject({ success: true });
});

test('a preflight OPTIONS request only reflects the allowed origin', async () => {
  const app = await importFreshApp();

  const expectedCode = 204;

  const allowedPreflight = await app.request('/api/test/profile', {
    headers: { 'Access-Control-Request-Method': 'POST', Origin: allowedOrigin },
    method: 'OPTIONS',
  });
  const disallowedPreflight = await app.request('/api/test/profile', {
    headers: { 'Access-Control-Request-Method': 'POST', Origin: disallowedOrigin },
    method: 'OPTIONS',
  });

  expect(allowedPreflight.status).toBe(expectedCode);
  expect(allowedPreflight.headers.get('access-control-allow-origin')).toBe(allowedOrigin);

  expect(disallowedPreflight.status).toBe(expectedCode);
  expect(disallowedPreflight.headers.get('access-control-allow-origin')).toBeNull();
});

test('ADDITIONAL_CORS_ORIGINS extends the allowlist once the app module is freshly loaded', async () => {
  const extraOrigin = 'https://extra.example.com';
  const app = await importFreshApp({ ADDITIONAL_CORS_ORIGINS: extraOrigin, ENV: 'local' });

  const expectedCode = 200;

  const res = await app.request('/api/test/hello', { headers: { Origin: extraOrigin } });

  expect(res.headers.get('access-control-allow-origin')).toBe(extraOrigin);
  expect(res.status).toBe(expectedCode);
});
