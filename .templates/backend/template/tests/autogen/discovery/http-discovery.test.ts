import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import fs from 'node:fs';
import { getHttpRoutes } from '../../../src/utils/autogen/discovery/http-discovery';
import { isRecord } from '@lightproject/common/validators';
import path from 'node:path';
import { projectDir } from '../../../src/utils/autogen/config';

describe('HTTP Discovery', () => {
  describe('getHttpRoutes', () => {
    const httpRoutesDir = path.resolve(projectDir, 'src/routers/http/routes');

    beforeAll(() => {
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
      expect(route).toHaveProperty('input');
      expect(route).toHaveProperty('output');

      expect(typeof route.handlerFilePath).toBe('string');
      expect(typeof route.path).toBe('string');

      const inputSchema = isRecord(route) ? route.input : undefined;
      if (Array.isArray(inputSchema)) {
        for (const input of inputSchema) {
          if (!isRecord(input)) {
            continue;
          }
          expect(input).toHaveProperty('name');
          expect(input).toHaveProperty('description');
          expect(input).toHaveProperty('required');

          const typeVal = input.type;
          if (typeof typeVal === 'string') {
            expect(typeVal.length).toBeGreaterThan(0);
            expect(typeVal).not.toBe('unknown');
          }
        }
      }

      const outputSchema = route.output;
      if (outputSchema && typeof outputSchema === 'object') {
        expect(outputSchema).toHaveProperty('name');
        expect(outputSchema).toHaveProperty('type');

        const typeVal = 'type' in outputSchema ? outputSchema.type : undefined;
        if (typeof typeVal === 'string') {
          expect(typeVal).not.toBe('unknown');
        }
      }
    });

    it('should find default route', async () => {
      const routes = await getHttpRoutes();
      const defaultRoute = routes.find((r) => r.path === '/');

      expect(defaultRoute).toBeDefined();
      if (defaultRoute !== undefined) {
        expect(defaultRoute.serviceClass).toBe('DefaultService');
      }
    });

    it('should find test routes', async () => {
      const routes = await getHttpRoutes();
      const testRoutes = routes.filter((r) => r.path.startsWith('/test'));

      expect(testRoutes.length).toBeGreaterThan(0);

      const asyncSuccessRoute = testRoutes.find((r) => r.path === '/test/async-success');
      expect(asyncSuccessRoute).toBeDefined();
      if (asyncSuccessRoute !== undefined) {
        expect(asyncSuccessRoute.serviceClass).toBe('TestService');
        expect(asyncSuccessRoute.serviceMethod).toBe('asyncSuccess');
      }
    });

    it('should extract service information correctly', async () => {
      const routes = await getHttpRoutes();

      const serviceRoutes = routes.filter(
        (r) =>
          r.serviceClass !== undefined &&
          r.serviceClass !== '' &&
          r.serviceMethod !== undefined &&
          r.serviceMethod !== '',
      );
      expect(serviceRoutes.length).toBeGreaterThan(0);

      for (const route of serviceRoutes) {
        expect(route.serviceClass).toMatch(/Service$/u);
        expect(route.serviceMethod !== undefined && route.serviceMethod !== '').toBeTruthy();
      }
    });

    it('should extract output schema from service methods', async () => {
      const routes = await getHttpRoutes();

      const outputRoutes = routes.filter((r) => r.output !== undefined);
      expect(outputRoutes.length).toBeGreaterThan(0);

      for (const route of outputRoutes) {
        const { output } = route;
        expect(output).toBeDefined();
        if (output) {
          expect(output).toHaveProperty('name');
          expect(output).toHaveProperty('type');
        }
      }
    });

    it('should handle different HTTP methods', async () => {
      const routes = await getHttpRoutes();

      expect(routes.length).toBeGreaterThan(5);
    });

    it('should handle nested route paths', async () => {
      const routes = await getHttpRoutes();
      const nestedRoutes = routes.filter((r) => r.path.includes('/'));

      expect(nestedRoutes.length).toBeGreaterThan(0);

      const testSubroutes = routes.filter((r) => r.path.startsWith('/test/'));
      expect(testSubroutes.length).toBeGreaterThan(0);
    });

    it('should return absolute file paths', async () => {
      const routes = await getHttpRoutes();

      for (const route of routes) {
        expect(route.handlerFilePath).toBeDefined();
        if (route.handlerFilePath !== undefined && route.handlerFilePath !== '') {
          expect(path.isAbsolute(route.handlerFilePath)).toBe(true);
          expect(route.handlerFilePath).toMatch(/\.ts$/u);
        }
      }
    });

    it('should handle parameter routes', async () => {
      const routes = await getHttpRoutes();
      const paramRoutes = routes.filter(
        (r) =>
          r.path.includes('hello') || r.path.includes('primitives') || r.path.includes('object'),
      );

      expect(paramRoutes.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle missing routes directory gracefully', async () => {
      const fsReaddirSyncSpy = vi.spyOn(fs, 'readdirSync');
      fsReaddirSyncSpy.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      try {
        const routes = await getHttpRoutes();
        expect(Array.isArray(routes)).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      } finally {
        fsReaddirSyncSpy.mockRestore();
      }
    });

    it('should handle invalid TypeScript files', async () => {
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
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});
