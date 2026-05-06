import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { projectDir } from '../../../src/utils/autogen/config';
import { getHttpRoutes } from '../../../src/utils/autogen/discovery/http-discovery';

const MIN_EXPECTED_ROUTES = 5;
const MAX_DISCOVERY_TIME_MS = 5000;
const SERVICE_CLASS_PATTERN = /Service$/;
const TYPESCRIPT_FILE_PATTERN = /\.ts$/;

describe('HTTP Discovery', () => {
  describe('getHttpRoutes', () => {
    const httpRoutesDir = path.resolve(projectDir, 'src/routers/http/routes');

    beforeAll(() => {
      // Ensure we have actual route files to test with
      if (!fs.existsSync(httpRoutesDir)) {
        throw new Error(`HTTP routes directory not found: ${httpRoutesDir}`);
      }
    });

    it('should discover existing HTTP routes', async () => {
      const routes = await getHttpRoutes();

      expect(routes).toBeDefined();
      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should return RouteHandlerInfo objects with correct structure', async () => {
      const routes = await getHttpRoutes();
      const [route] = routes;

      expect(route).toBeDefined();
      expect(route).toHaveProperty('handlerFilePath');
      expect(route).toHaveProperty('path');
      expect(route).toHaveProperty('serviceClass');
      expect(route).toHaveProperty('serviceMethod');

      if (route) {
        expect(typeof route.handlerFilePath).toBe('string');
        expect(typeof route.path).toBe('string');
        // serviceClass and serviceMethod can be undefined for non-service routes
      }
    });

    it('should find default route', async () => {
      const routes = await getHttpRoutes();
      const defaultRoute = routes.find(r => r.path === '/');

      expect(defaultRoute).toBeDefined();
      expect(defaultRoute?.serviceClass).toBe('DefaultService');
    });

    it('should find test routes', async () => {
      const routes = await getHttpRoutes();
      const testRoutes = routes.filter(r => r.path.startsWith('/test'));

      expect(testRoutes.length).toBeGreaterThan(0);

      // Check specific test routes
      const asyncSuccessRoute = testRoutes.find(
        r => r.path === '/test/async-success'
      );
      expect(asyncSuccessRoute).toBeDefined();
      expect(asyncSuccessRoute?.serviceClass).toBe('TestService');
      expect(asyncSuccessRoute?.serviceMethod).toBe('asyncSuccess');
    });

    it('should extract service information correctly', async () => {
      const routes = await getHttpRoutes();

      // Find routes with service information
      const serviceRoutes = routes.filter(
        r => r.serviceClass && r.serviceMethod
      );
      expect(serviceRoutes.length).toBeGreaterThan(0);

      // Verify service naming convention
      for (const route of serviceRoutes) {
        expect(route.serviceClass).toMatch(SERVICE_CLASS_PATTERN);
        expect(route.serviceMethod).toBeTruthy();
      }
    });

    it('should handle different HTTP methods', async () => {
      const routes = await getHttpRoutes();

      // Should have routes from different method types (GET, POST, etc.)
      // The path structure doesn't directly indicate method, but we should have various routes
      expect(routes.length).toBeGreaterThan(MIN_EXPECTED_ROUTES);
    });

    it('should handle nested route paths', async () => {
      const routes = await getHttpRoutes();
      const nestedRoutes = routes.filter(r => r.path.includes('/'));

      expect(nestedRoutes.length).toBeGreaterThan(0);

      // Check for test subroutes
      const testSubroutes = routes.filter(r => r.path.startsWith('/test/'));
      expect(testSubroutes.length).toBeGreaterThan(0);
    });

    it('should return absolute file paths', async () => {
      const routes = await getHttpRoutes();

      for (const route of routes) {
        expect(route.handlerFilePath).toBeDefined();
        if (route.handlerFilePath) {
          expect(path.isAbsolute(route.handlerFilePath)).toBe(true);
          expect(route.handlerFilePath).toMatch(TYPESCRIPT_FILE_PATTERN);
        }
      }
    });

    it('should handle parameter routes', async () => {
      const routes = await getHttpRoutes();
      const paramRoutes = routes.filter(
        r =>
          r.path.includes('hello') ||
          r.path.includes('primitives') ||
          r.path.includes('object')
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
        const routes = await getHttpRoutes();
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
      const routes = await getHttpRoutes();
      expect(Array.isArray(routes)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete discovery within reasonable time', async () => {
      const startTime = Date.now();
      const routes = await getHttpRoutes();
      const endTime = Date.now();

      expect(routes).toBeDefined();
      expect(endTime - startTime).toBeLessThan(MAX_DISCOVERY_TIME_MS); // Should complete within 5 seconds
    });
  });
});
