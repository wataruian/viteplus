import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

const endpointsEnvKeys = [
  'BACKEND_URL',
  'FRONTEND_URL',
  'API_URL',
  'ADMIN_URL',
  'SITE_URL',
  'VITE_BACKEND_URL',
  'VITE_FRONTEND_URL',
  'VITE_API_URL',
  'VITE_ADMIN_URL',
  'VITE_SITE_URL',
] as const;

const importFresh = async (env: Record<string, string | undefined> = {}) => {
  vi.resetModules();
  for (const key of endpointsEnvKeys) {
    vi.stubEnv(key, env[key]);
  }
  return await import('../../src/configs/endpoints');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('base URLs', () => {
  test('default to localhost when no env vars are set', async () => {
    const { adminUrl, apiBaseUrl, backendBaseUrl, frontendUrl, siteUrl } = await importFresh();
    expect(backendBaseUrl).toBe('http://localhost:2000');
    expect(frontendUrl).toBe('http://localhost:2001');
    expect(apiBaseUrl).toBe('http://localhost:3000');
    expect(adminUrl).toBe('http://localhost:3001');
    expect(siteUrl).toBe('http://localhost:3002');
  });

  test('use BACKEND_URL/FRONTEND_URL/API_URL/ADMIN_URL/SITE_URL when set', async () => {
    const { adminUrl, apiBaseUrl, backendBaseUrl, frontendUrl, siteUrl } = await importFresh({
      ADMIN_URL: 'https://admin.example.com',
      API_URL: 'https://api.example.com',
      BACKEND_URL: 'https://backend.example.com',
      FRONTEND_URL: 'https://frontend.example.com',
      SITE_URL: 'https://example.com',
    });
    expect(backendBaseUrl).toBe('https://backend.example.com');
    expect(frontendUrl).toBe('https://frontend.example.com');
    expect(apiBaseUrl).toBe('https://api.example.com');
    expect(adminUrl).toBe('https://admin.example.com');
    expect(siteUrl).toBe('https://example.com');
  });

  test('fall back to VITE_-prefixed env vars', async () => {
    const { adminUrl, apiBaseUrl, backendBaseUrl, frontendUrl, siteUrl } = await importFresh({
      ADMIN_URL: undefined,
      API_URL: undefined,
      BACKEND_URL: undefined,
      FRONTEND_URL: undefined,
      SITE_URL: undefined,
      VITE_ADMIN_URL: 'https://vite-admin.example.com',
      VITE_API_URL: 'https://vite-api.example.com',
      VITE_BACKEND_URL: 'https://vite-backend.example.com',
      VITE_FRONTEND_URL: 'https://vite-frontend.example.com',
      VITE_SITE_URL: 'https://vite-site.example.com',
    });
    expect(backendBaseUrl).toBe('https://vite-backend.example.com');
    expect(frontendUrl).toBe('https://vite-frontend.example.com');
    expect(apiBaseUrl).toBe('https://vite-api.example.com');
    expect(adminUrl).toBe('https://vite-admin.example.com');
    expect(siteUrl).toBe('https://vite-site.example.com');
  });
});

describe('derived endpoints and urls', () => {
  test('are built from backendBaseUrl', async () => {
    const endpoints = await importFresh({ BACKEND_URL: 'https://backend.example.com' });
    expect(endpoints.backendHealthCheckUrl).toBe('https://backend.example.com/');
    expect(endpoints.backendUrl).toBe('https://backend.example.com/api');
    expect(endpoints.backendDocsHttpUrl).toBe('https://backend.example.com/docs/http');
    expect(endpoints.backendDocsTrpcUrl).toBe('https://backend.example.com/docs/trpc');
    expect(endpoints.backendTrpcUrl).toBe('https://backend.example.com/trpc');
    expect(endpoints.openApiHttpJsonEndpoint).toBe('/docs/openapi-http.json');
    expect(endpoints.openApiTrpcJsonEndpoint).toBe('/docs/openapi-trpc.json');
  });

  test('are built from apiBaseUrl', async () => {
    const endpoints = await importFresh({ API_URL: 'https://api.example.com' });
    expect(endpoints.apiHealthCheckUrl).toBe('https://api.example.com/');
    expect(endpoints.apiUrl).toBe('https://api.example.com/api');
    expect(endpoints.apiDocsHttpUrl).toBe('https://api.example.com/docs/http');
    expect(endpoints.apiDocsTrpcUrl).toBe('https://api.example.com/docs/trpc');
    expect(endpoints.apiTrpcUrl).toBe('https://api.example.com/trpc');
  });

  test('share the same endpoint paths', async () => {
    const endpoints = await importFresh();
    expect(endpoints.healthCheckEndpoint).toBe('/');
    expect(endpoints.httpEndpoint).toBe('/api');
    expect(endpoints.trpcEndpoint).toBe('/trpc');
    expect(endpoints.docsEndpoint).toBe('/docs');
    expect(endpoints.docsHttpEndpoint).toBe('/docs/http');
    expect(endpoints.docsTrpcEndpoint).toBe('/docs/trpc');
  });
});

describe('isTrpcEndpoint', () => {
  test('matches both a relative path and a full URL under /trpc', async () => {
    const { isTrpcEndpoint } = await importFresh();
    expect(isTrpcEndpoint('/trpc/test.hello')).toBe(true);
    expect(isTrpcEndpoint('http://localhost:2000/trpc/test.hello')).toBe(true);
  });

  test('matches a full URL under /trpc on any backend origin', async () => {
    const { isTrpcEndpoint } = await importFresh();
    expect(isTrpcEndpoint('https://other-backend.example.com/trpc/test.hello')).toBe(true);
    expect(isTrpcEndpoint('https://other-backend.example.com/api/trpc')).toBe(false);
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
