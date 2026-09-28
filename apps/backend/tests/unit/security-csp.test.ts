import { adminUrl, apiBaseUrl, docsHttpEndpoint, siteUrl } from '@lightproject/common/configs';
import { afterAll, afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { isDocsPath } from '../../src/middlewares/security';
import { runtimes } from './helpers/utils';

const defaultOrigins = [apiBaseUrl, siteUrl, adminUrl];

afterEach(() => {
  vi.unstubAllEnvs();
});

const parseCsp = (csp: string | null) =>
  new Map(
    (csp ?? '').split(';').map((directive) => {
      const [name, ...values] = directive.trim().split(' ');
      return [name, values];
    }),
  );

test('isDocsPath matches the docs root and its sub-paths only', () => {
  expect(isDocsPath('/docs')).toBe(true);
  expect(isDocsPath('/docs/http')).toBe(true);
  expect(isDocsPath('/docsearch')).toBe(false);
  expect(isDocsPath('/api/test/hello')).toBe(false);
});

describe.each(runtimes)('on $name', ({ cleanup, importApp }) => {
  afterAll(cleanup);

  test('the CSP header is present on both HTTP and tRPC responses and includes the default origins', async () => {
    const app = await importApp();

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
    const app = await importApp();

    const res = await app.request('/api/test/hello');
    const csp = res.headers.get('content-security-policy');

    expect(csp).not.toContain('example.com');
  });

  test('ADDITIONAL_CORS_ORIGINS extends script-src/worker-src but not style-src', async () => {
    const extraOrigin = 'https://extra.example.com';
    const app = await importApp({ ADDITIONAL_CORS_ORIGINS: extraOrigin, ENV: 'local' });

    const res = await app.request('/api/test/hello');
    const csp = res.headers.get('content-security-policy');
    expect(csp).not.toBeNull();

    const directives = parseCsp(csp);

    expect(directives.get('script-src')).toContain(extraOrigin);
    expect(directives.get('worker-src')).toContain(extraOrigin);
    expect(directives.get('style-src')).not.toContain(extraOrigin);
  });

  test('API responses forbid inline code and the Swagger CDN', async () => {
    const app = await importApp();

    const res = await app.request('/api/test/hello');
    const directives = parseCsp(res.headers.get('content-security-policy'));

    for (const name of ['script-src', 'style-src']) {
      expect(directives.get(name)).not.toContain("'unsafe-inline'");
      expect(directives.get(name)).not.toContain('https://cdn.jsdelivr.net');
    }
  });

  test('Swagger UI pages allow its inline bootstrap and CDN bundle', async () => {
    const app = await importApp({ ENV: 'local' });

    const res = await app.request(docsHttpEndpoint);
    expect(res.status).toBe(200);

    const directives = parseCsp(res.headers.get('content-security-policy'));
    for (const name of ['script-src', 'style-src']) {
      expect(directives.get(name)).toContain("'unsafe-inline'");
      expect(directives.get(name)).toContain('https://cdn.jsdelivr.net');
    }
  });
});
