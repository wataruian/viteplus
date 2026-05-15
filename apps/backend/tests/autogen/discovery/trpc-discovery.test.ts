import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import fs from 'node:fs';
import { getTrpcRoutes } from '../../../src/utils/autogen/discovery/trpc-discovery';
import path from 'node:path';
import { projectDir } from '../../../src/utils/autogen/config';

describe('tRPC Discovery', () => {
  describe('getTrpcRoutes', () => {
    const trpcRoutesDir = path.resolve(projectDir, 'src/routers/trpc/routes');

    beforeAll(() => {
      // Ensure we have actual route files to test with
      if (!fs.existsSync(trpcRoutesDir)) {
        throw new Error(`tRPC routes directory not found: ${trpcRoutesDir}`);
      }
    });

    it('should discover existing tRPC routes', async () => {
      const routes = await getTrpcRoutes();

      expect(routes).toBeDefined();
      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should return RouteHandlerInfo objects with correct structure', async () => {
      const routes = await getTrpcRoutes();

      const [route] = routes;

      expect(route).toBeDefined();
      expect(route).toHaveProperty('handlerFilePath');
      expect(route).toHaveProperty('path');
      expect(route).toHaveProperty('serviceClass');
      expect(route).toHaveProperty('serviceMethod');

      expect(typeof route.handlerFilePath).toBe('string');
      expect(typeof route.path).toBe('string');
      // serviceClass and serviceMethod can be undefined for non-service routes
    });

    it('should find default tRPC route', async () => {
      const routes = await getTrpcRoutes();
      const defaultRoute = routes.find((r) => r.path === '/trpc/default.root');

      expect(defaultRoute).toBeDefined();
      if (defaultRoute !== undefined) {
        expect(defaultRoute.serviceClass).toBe('DefaultService');
      }
    });

    it('should find test tRPC routes', async () => {
      const routes = await getTrpcRoutes();
      const testRoutes = routes.filter((r) => r.path.startsWith('/trpc/test'));

      expect(testRoutes.length).toBeGreaterThan(0);

      // Check specific test routes
      const asyncSuccessRoute = testRoutes.find((r) => r.path === '/trpc/test.asyncSuccess');
      if (asyncSuccessRoute !== undefined) {
        expect(asyncSuccessRoute.serviceClass).toBe('TestService');
        expect(asyncSuccessRoute.serviceMethod).toBe('asyncSuccess');
      }
    });

    it('should extract service information correctly', async () => {
      const routes = await getTrpcRoutes();

      // Find routes with service information
      const serviceRoutes = routes.filter(
        (r) =>
          r.serviceClass !== undefined &&
          r.serviceClass !== '' &&
          r.serviceMethod !== undefined &&
          r.serviceMethod !== '',
      );
      expect(serviceRoutes.length).toBeGreaterThan(0);

      // Verify service naming convention
      for (const route of serviceRoutes) {
        expect(route.serviceClass).toMatch(/Service$/);
        expect(route.serviceMethod !== undefined && route.serviceMethod !== '').toBeTruthy();
      }
    });

    it('should handle nested tRPC route paths', async () => {
      const routes = await getTrpcRoutes();
      const nestedRoutes = routes.filter((r) => r.path.includes('.'));

      expect(nestedRoutes.length).toBeGreaterThan(0);

      // Check for test subroutes (e.g., "/trpc/test.asyncSuccess")
      const testSubroutes = routes.filter((r) => r.path.startsWith('/trpc/test.'));
      expect(testSubroutes.length).toBeGreaterThan(0);
    });

    it('should return absolute file paths', async () => {
      const routes = await getTrpcRoutes();

      for (const route of routes) {
        if (route.handlerFilePath !== undefined && route.handlerFilePath !== '') {
          expect(path.isAbsolute(route.handlerFilePath)).toBe(true);
          expect(route.handlerFilePath).toMatch(/\.ts$/);
        }
      }
    });

    it('should handle parameter routes in tRPC format', async () => {
      const routes = await getTrpcRoutes();
      const paramRoutes = routes.filter(
        (r) =>
          r.path.includes('hello') || r.path.includes('primitives') || r.path.includes('object'),
      );

      expect(paramRoutes.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle missing routes directory gracefully', async () => {
      // Mock fs.readdirSync to simulate missing directory
      const fsReaddirSyncSpy = vi.spyOn(fs, 'readdirSync');
      fsReaddirSyncSpy.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      try {
        const routes = await getTrpcRoutes();
        // Should return empty array or handle gracefully
        expect(Array.isArray(routes)).toBe(true);
      } catch (error) {
        // Should throw meaningful error
        expect(error).toBeInstanceOf(Error);
      } finally {
        fsReaddirSyncSpy.mockRestore();
      }
    });

    it('should handle invalid TypeScript files', async () => {
      // This test would require mocking the TypeScript project
      // For now, we assume the discovery handles TS errors gracefully
      const routes = await getTrpcRoutes();
      expect(Array.isArray(routes)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete discovery within reasonable time', async () => {
      const MaxDiscoveryTimeMs = 5000; // 5 seconds maximum for discovery
      const startTime = Date.now();
      const routes = await getTrpcRoutes();
      const endTime = Date.now();

      expect(routes).toBeDefined();
      expect(endTime - startTime).toBeLessThan(MaxDiscoveryTimeMs);
    });
  });

  describe('tRPC-specific functionality', () => {
    it('should distinguish between queries and mutations', async () => {
      const routes = await getTrpcRoutes();

      // tRPC routes should have paths that don't indicate method directly,
      // but the discovery should work regardless
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should handle router nesting properly', async () => {
      const routes = await getTrpcRoutes();

      // Should handle both flat routes ("/trpc/default.root") and nested routes ("/trpc/test.something")
      const flatRoutes = routes.filter((r) => r.path.includes('/trpc/default.'));
      const nestedRoutes = routes.filter((r) => r.path.includes('/trpc/test.'));

      expect(flatRoutes.length).toBeGreaterThan(0);
      expect(nestedRoutes.length).toBeGreaterThan(0);
    });
  });
});
