import { adminUrl, apiBaseUrl, siteUrl } from '@lightproject/common/configs';
import { afterEach, expect, test, vi } from 'vite-plus/test';

import { importFreshApp } from './helpers/fresh-app';

const defaultOrigins = [apiBaseUrl, siteUrl, adminUrl];

afterEach(() => {
  vi.unstubAllEnvs();
});

test('the CSP header is present on both HTTP and tRPC responses and includes the default origins', async () => {
  const app = await importFreshApp();

  const httpRes = await app.request('/api/test/hello');
  const trpcRes = await app.request(
    `/trpc/test.hello?input=${encodeURIComponent(JSON.stringify({}))}`,
  );

  for (const res of [httpRes, trpcRes]) {
    const csp = res.headers.get('content-security-policy');
    expect(csp).not.toBeNull();
    expect(csp).toContain("default-src 'self'");
    for (const origin of defaultOrigins) {
      expect(csp).toContain(origin);
    }
  }
});

test('an untrusted origin never appears in the CSP header ("failure" case)', async () => {
  const app = await importFreshApp();

  const res = await app.request('/api/test/hello');
  const csp = res.headers.get('content-security-policy');

  expect(csp).not.toContain('example.com');
});

test('ADDITIONAL_CORS_ORIGINS extends script-src/worker-src but not style-src', async () => {
  const extraOrigin = 'https://extra.example.com';
  const app = await importFreshApp({ ADDITIONAL_CORS_ORIGINS: extraOrigin, ENV: 'local' });

  const res = await app.request('/api/test/hello');
  const csp = res.headers.get('content-security-policy');
  expect(csp).not.toBeNull();

  const directives = new Map(
    (csp ?? '').split(';').map((directive) => {
      const [name, ...values] = directive.trim().split(' ');
      return [name, values];
    }),
  );

  expect(directives.get('script-src')).toContain(extraOrigin);
  expect(directives.get('worker-src')).toContain(extraOrigin);
  expect(directives.get('style-src')).not.toContain(extraOrigin);
});
