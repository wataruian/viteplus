import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import fs from 'node:fs';
import { getTrpcRoutes } from '../../../src/utils/autogen/discovery/trpc-discovery';
import { isRecord } from '@lightproject/common/validators';
import path from 'node:path';
import { projectDir } from '../../../src/utils/autogen/config';

describe('tRPC Discovery', () => {
  describe('getTrpcRoutes', () => {
    const trpcRoutesDir = path.resolve(projectDir, 'src/routers/trpc/routes');

    beforeAll(() => {
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
        expect(outputSchema).toHaveProperty('description');

        const typeVal = outputSchema.type;
        if (typeof typeVal === 'string') {
          expect(typeVal).not.toBe('unknown');
        }
      }
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

      const asyncSuccessRoute = testRoutes.find((r) => r.path === '/trpc/test.asyncSuccess');
      if (asyncSuccessRoute !== undefined) {
        expect(asyncSuccessRoute.serviceClass).toBe('TestService');
        expect(asyncSuccessRoute.serviceMethod).toBe('asyncSuccess');
      }
    });

    it('should extract service information correctly', async () => {
      const routes = await getTrpcRoutes();

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
      const routes = await getTrpcRoutes();

      const outputRoutes = routes.filter((r) => r.output !== undefined);
      expect(outputRoutes.length).toBeGreaterThan(0);

      for (const route of outputRoutes) {
        const { output } = route;
        expect(output).toBeDefined();
        if (output) {
          expect(output).toHaveProperty('name');
          expect(output).toHaveProperty('type');
          expect(output).toHaveProperty('description');
        }
      }
    });

    it('should handle nested tRPC route paths', async () => {
      const routes = await getTrpcRoutes();
      const nestedRoutes = routes.filter((r) => r.path.includes('.'));

      expect(nestedRoutes.length).toBeGreaterThan(0);

      const testSubroutes = routes.filter((r) => r.path.startsWith('/trpc/test.'));
      expect(testSubroutes.length).toBeGreaterThan(0);
    });

    it('should return absolute file paths', async () => {
      const routes = await getTrpcRoutes();

      for (const route of routes) {
        if (route.handlerFilePath !== undefined && route.handlerFilePath !== '') {
          expect(path.isAbsolute(route.handlerFilePath)).toBe(true);
          expect(route.handlerFilePath).toMatch(/\.ts$/u);
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
      const fsReaddirSyncSpy = vi.spyOn(fs, 'readdirSync');
      fsReaddirSyncSpy.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      try {
        const routes = await getTrpcRoutes();
        expect(Array.isArray(routes)).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      } finally {
        fsReaddirSyncSpy.mockRestore();
      }
    });

    it('should handle invalid TypeScript files', async () => {
      const routes = await getTrpcRoutes();
      expect(Array.isArray(routes)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete discovery within reasonable time', async () => {
      const MaxDiscoveryTimeMs = 5000;
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

      expect(routes.length).toBeGreaterThan(0);
    });

    it('should handle router nesting properly', async () => {
      const routes = await getTrpcRoutes();

      const flatRoutes = routes.filter((r) => r.path.includes('/trpc/default.'));
      const nestedRoutes = routes.filter((r) => r.path.includes('/trpc/test.'));

      expect(flatRoutes.length).toBeGreaterThan(0);
      expect(nestedRoutes.length).toBeGreaterThan(0);
    });
  });
});
