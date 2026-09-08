import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

vi.mock('../src/utils/helpers', () => ({
  getMetaEnv: () => ({}),
}));

const endpointsEnvKeys = [
  'API_URL',
  'ADMIN_URL',
  'SITE_URL',
  'VITE_API_URL',
  'VITE_ADMIN_URL',
  'VITE_SITE_URL',
] as const;

const importFresh = async (env: Record<string, string | undefined> = {}) => {
  vi.resetModules();
  for (const key of endpointsEnvKeys) {
    vi.stubEnv(key, env[key]);
  }
  const endpoints = await import('../src/configs/endpoints');
  return endpoints;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('base URLs', () => {
  test('default to localhost when no env vars are set', async () => {
    const { adminUrl, apiBaseUrl, siteUrl } = await importFresh();
    expect(apiBaseUrl).toBe('http://localhost:3000');
    expect(adminUrl).toBe('http://localhost:3001');
    expect(siteUrl).toBe('http://localhost:3002');
  });

  test('use API_URL/ADMIN_URL/SITE_URL when set', async () => {
    const { adminUrl, apiBaseUrl, siteUrl } = await importFresh({
      ADMIN_URL: 'https://admin.example.com',
      API_URL: 'https://api.example.com',
      SITE_URL: 'https://example.com',
    });
    expect(apiBaseUrl).toBe('https://api.example.com');
    expect(adminUrl).toBe('https://admin.example.com');
    expect(siteUrl).toBe('https://example.com');
  });

  test('fall back to VITE_-prefixed env vars', async () => {
    const { adminUrl, apiBaseUrl, siteUrl } = await importFresh({
      ADMIN_URL: undefined,
      API_URL: undefined,
      SITE_URL: undefined,
      VITE_ADMIN_URL: 'https://vite-admin.example.com',
      VITE_API_URL: 'https://vite-api.example.com',
      VITE_SITE_URL: 'https://vite-site.example.com',
    });
    expect(apiBaseUrl).toBe('https://vite-api.example.com');
    expect(adminUrl).toBe('https://vite-admin.example.com');
    expect(siteUrl).toBe('https://vite-site.example.com');
  });
});

describe('derived endpoints and urls', () => {
  test('are built from apiBaseUrl', async () => {
    const endpoints = await importFresh({ API_URL: 'https://api.example.com' });
    expect(endpoints.healthCheckUrl).toBe('https://api.example.com/');
    expect(endpoints.apiUrl).toBe('https://api.example.com/api');
    expect(endpoints.docsHttpUrl).toBe('https://api.example.com/docs/http');
    expect(endpoints.docsTrpcUrl).toBe('https://api.example.com/docs/trpc');
    expect(endpoints.trpcUrl).toBe('https://api.example.com/trpc');
    expect(endpoints.openApiHttpJsonEndpoint).toBe('/docs/openapi-http.json');
    expect(endpoints.openApiTrpcJsonEndpoint).toBe('/docs/openapi-trpc.json');
  });
});

describe('isTrpcEndpoint', () => {
  test('matches both a relative path and a full URL under /trpc', async () => {
    const { isTrpcEndpoint } = await importFresh();
    expect(isTrpcEndpoint('/trpc/test.hello')).toBe(true);
    expect(isTrpcEndpoint('http://localhost:3000/trpc/test.hello')).toBe(true);
  });

  test('rejects non-tRPC paths', async () => {
    const { isTrpcEndpoint } = await importFresh();
    expect(isTrpcEndpoint('/api/test/hello')).toBe(false);
  });
});

describe('getRequestType', () => {
  test('returns tRPC for tRPC urls and HTTP otherwise', async () => {
    const { getRequestType, requestTypes } = await importFresh();
    expect(getRequestType('/trpc/test.hello')).toBe(requestTypes.trpc);
    expect(getRequestType('/api/test/hello')).toBe(requestTypes.http);
  });
});

describe('isTrpcRequest', () => {
  test('returns true for the tRPC request type', async () => {
    const { isTrpcRequest, requestTypes } = await importFresh();
    expect(isTrpcRequest(requestTypes.trpc)).toBe(true);
  });

  test('returns false for the HTTP request type', async () => {
    const { isTrpcRequest, requestTypes } = await importFresh();
    expect(isTrpcRequest(requestTypes.http)).toBe(false);
  });
});
