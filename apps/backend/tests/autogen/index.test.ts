import { describe, expect, it } from 'vite-plus/test';
import { extractAllRoutes } from '../../src/utils/autogen';

describe('Autogen Main', () => {
  describe('extractAllRoutes', () => {
    it('should discover both HTTP and tRPC routes', async () => {
      const routes = await extractAllRoutes();

      expect(routes).toBeDefined();
      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should return RouteInfo objects with correct structure', async () => {
      const routes = await extractAllRoutes();

      if (routes.length > 0) {
        const [route] = routes;

        expect(route).toBeDefined();

        expect(route).toHaveProperty('path');
        expect(route).toHaveProperty('requestType');

        expect(typeof route.path).toBe('string');
        expect(typeof route.requestType).toBe('string');
        expect(['HTTP', 'tRPC']).toContain(route.requestType);
      }
    });

    it('should find both HTTP and tRPC routes', async () => {
      const routes = await extractAllRoutes();

      const httpRoutes = routes.filter((r) => r.requestType === 'HTTP');
      const trpcRoutes = routes.filter((r) => r.requestType === 'tRPC');

      expect(httpRoutes.length).toBeGreaterThan(0);
      expect(trpcRoutes.length).toBeGreaterThan(0);
    });

    it('should include service metadata when available', async () => {
      const routes = await extractAllRoutes();

      const routesWithService = routes.filter(
        (r) =>
          r.serviceClass !== undefined &&
          r.serviceClass !== '' &&
          r.serviceMethod !== undefined &&
          r.serviceMethod !== '',
      );

      expect(routesWithService.length).toBeGreaterThan(0);

      // Check service naming convention
      for (const route of routesWithService) {
        expect(route.serviceClass).toMatch(/Service$/);
        expect(route.serviceMethod !== undefined && route.serviceMethod !== '').toBeTruthy();
      }
    });

    it('should include parameter metadata', async () => {
      const routes = await extractAllRoutes();

      const routesWithParams = routes.filter((r) => r.input !== undefined && r.input.length > 0);

      if (routesWithParams.length > 0) {
        const [route] = routesWithParams;
        if (route.input !== undefined && route.input.length > 0) {
          const [param] = route.input;

          expect(param).toHaveProperty('name');
          expect(param).toHaveProperty('type');
          expect(param).toHaveProperty('required');
        }
      }
    });

    it('should handle different route types', async () => {
      const routes = await extractAllRoutes();

      // Should have various path patterns
      const rootRoutes = routes.filter((r) => r.path === '/' || r.path === 'root');
      const testRoutes = routes.filter(
        (r) => r.path.includes('test') || r.path.startsWith('/test'),
      );

      expect(rootRoutes.length).toBeGreaterThan(0);
      expect(testRoutes.length).toBeGreaterThan(0);
    });

    it('should provide file path information', async () => {
      const routes = await extractAllRoutes();

      const routesWithHandlerFile = routes.filter(
        (r) => r.handlerFilePath !== undefined && r.handlerFilePath !== '',
      );

      expect(routesWithHandlerFile.length).toBeGreaterThan(0);

      for (const route of routesWithHandlerFile) {
        expect(route.handlerFilePath).toMatch(/\.ts$/);
      }
    });

    it('should provide service file path information', async () => {
      const routes = await extractAllRoutes();

      const routesWithServiceFile = routes.filter(
        (r) => r.serviceFilePath !== undefined && r.serviceFilePath !== '',
      );

      expect(routesWithServiceFile.length).toBeGreaterThan(0);

      for (const route of routesWithServiceFile) {
        expect(route.serviceFilePath).toMatch(/\.ts$/);
        expect(route.serviceFilePath).toMatch(/services/);
      }
    });
  });

  describe('Route discovery coverage', () => {
    it('should discover expected number of routes', async () => {
      const routes = await extractAllRoutes();

      // Based on the previous successful run, we expect around 27 routes
      expect(routes.length).toBeGreaterThanOrEqual(20);
      expect(routes.length).toBeLessThanOrEqual(35);
    });

    it('should find default routes', async () => {
      const routes = await extractAllRoutes();

      const defaultHttpRoute = routes.find((r) => r.path === '/' && r.requestType === 'HTTP');
      const defaultTrpcRoute = routes.find(
        (r) => r.path === '/trpc/default.root' && r.requestType === 'tRPC',
      );

      expect(defaultHttpRoute).toBeDefined();
      expect(defaultTrpcRoute).toBeDefined();
    });

    it('should find test routes in both HTTP and tRPC', async () => {
      const routes = await extractAllRoutes();

      const httpTestRoutes = routes.filter(
        (r) => r.requestType === 'HTTP' && r.path.startsWith('/test'),
      );
      const trpcTestRoutes = routes.filter(
        (r) => r.requestType === 'tRPC' && r.path.startsWith('/trpc/test'),
      );

      expect(httpTestRoutes.length).toBeGreaterThan(0);
      expect(trpcTestRoutes.length).toBeGreaterThan(0);
    });

    it('should have consistent service mapping between HTTP and tRPC', async () => {
      const routes = await extractAllRoutes();

      const httpRoutesWithService = routes.filter(
        (r) => r.requestType === 'HTTP' && r.serviceClass !== undefined && r.serviceClass !== '',
      );
      const trpcRoutesWithService = routes.filter(
        (r) => r.requestType === 'tRPC' && r.serviceClass !== undefined && r.serviceClass !== '',
      );

      // Should have service routes in both types
      expect(httpRoutesWithService.length).toBeGreaterThan(0);
      expect(trpcRoutesWithService.length).toBeGreaterThan(0);

      // Check for common services
      const httpServices = new Set(httpRoutesWithService.map((r) => r.serviceClass));
      const trpcServices = new Set(trpcRoutesWithService.map((r) => r.serviceClass));

      // Should have overlapping services
      const commonServices = [...httpServices].filter((s) => trpcServices.has(s));
      expect(commonServices.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and reliability', () => {
    it('should complete discovery within reasonable time', async () => {
      const startTime = Date.now();
      const routes = await extractAllRoutes();
      const endTime = Date.now();

      expect(routes).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10_000);
    });

    it('should be deterministic', async () => {
      const routes1 = await extractAllRoutes();
      const routes2 = await extractAllRoutes();

      expect(routes1.length).toBe(routes2.length);

      // Sort routes by path for comparison
      const sorted1 = routes1.toSorted((a, b) => a.path.localeCompare(b.path));
      const sorted2 = routes2.toSorted((a, b) => a.path.localeCompare(b.path));

      for (const [i, element] of sorted1.entries()) {
        const correspondingRoute = sorted2[i];
        expect(element.path).toBe(correspondingRoute.path);
        expect(element.requestType).toBe(correspondingRoute.requestType);
      }
    });
  });

  describe('Error handling', () => {
    it('should handle discovery errors gracefully', async () => {
      // The function should not throw even if individual route files have issues
      const routes = await extractAllRoutes();
      expect(Array.isArray(routes)).toBe(true);
    });
  });
});
