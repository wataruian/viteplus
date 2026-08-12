import { describe, expect, it } from 'vite-plus/test';
import { extractAllRoutes, validateRoutes } from '../../src/utils/autogen';

describe('Autogen Refactored', () => {
  it('should extract all routes properly without failing', async () => {
    const routes = await extractAllRoutes();
    expect(routes.length).toBeGreaterThan(0);

    const httpRoutes = routes.filter((r) => r.requestType === 'HTTP');
    expect(httpRoutes.length).toBeGreaterThan(0);

    const trpcRoutes = routes.filter((r) => r.requestType === 'tRPC');
    expect(trpcRoutes.length).toBeGreaterThan(0);
  });

  const validRoutes = [
    {
      method: 'GET',
      name: 'http routes for TestService',
      path: '/api/test',
      requestType: 'HTTP' as const,
      serviceClass: 'TestService',
      serviceMethod: 'testMethod',
    },
    {
      method: 'GET',
      name: 'trpc routes for TestService',
      path: '/trpc/router.testMethod',
      requestType: 'tRPC' as const,
      serviceClass: 'TestService',
      serviceMethod: 'testMethod',
    },
    {
      method: 'GET',
      name: 'http routes for DefaultService',
      path: '/api/default',
      requestType: 'HTTP' as const,
      serviceClass: 'DefaultService',
      serviceMethod: 'defaultMethod',
    },
    {
      method: 'GET',
      name: 'trpc routes for DefaultService',
      path: '/trpc/router.defaultMethod',
      requestType: 'tRPC' as const,
      serviceClass: 'DefaultService',
      serviceMethod: 'defaultMethod',
    },
  ];

  it.each(validRoutes)('should validate correctly formatted $name', (route) => {
    const result = validateRoutes([route]);
    expect(result.isValid).toBe(true);
  });
});
