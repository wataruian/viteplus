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

    it('should include output metadata', async () => {
      const routes = await extractAllRoutes();

      const routesWithOutput = routes.filter((r) => r.output !== undefined && r.output.length > 0);

      expect(routesWithOutput.length).toBeGreaterThan(0);

      for (const route of routesWithOutput) {
        const output = route.output ?? [];
        const [field] = output;
        expect(field).toBeDefined();
        expect(field).toHaveProperty('name');
        expect(field).toHaveProperty('type');
        expect(field.type).not.toBe('unknown');
      }
    });

    it('should handle different route types', async () => {
      const routes = await extractAllRoutes();

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

      expect(httpRoutesWithService.length).toBeGreaterThan(0);
      expect(trpcRoutesWithService.length).toBeGreaterThan(0);

      const httpServices = new Set(httpRoutesWithService.map((r) => r.serviceClass));
      const trpcServices = new Set(trpcRoutesWithService.map((r) => r.serviceClass));

      const commonServices = [...httpServices].filter((s) => trpcServices.has(s));
      expect(commonServices.length).toBeGreaterThan(0);
    });
  });

  describe('Route input/output shapes', () => {
    const messageOutput = [{ name: 'message', required: true, type: 'string' }] as const;

    const errorOutput = [
      {
        name: 'error',
        required: true,
        type: '{ message: string; name: string; stack: string; statusCode: number; }',
      },
      ...messageOutput,
    ] as const;

    const sharedRouteCases = [
      {
        httpPath: '/test/_check-params',
        input: [
          { name: '_stringInput', required: false, type: 'string' },
          { name: '_stringArrayInput', required: false },
          { name: '_numberInput', required: false, type: 'number' },
          { name: '_numberArrayInput', required: false },
          { name: '_booleanInput', required: false, type: 'boolean' },
          { name: '_booleanArrayInput', required: false },
          { name: '_objectStringInput', required: false, type: '{ string: string; }' },
          { name: '_objectStringArrayInput', required: false },
          { name: '_objectNumberInput', required: false, type: '{ number: number; }' },
          { name: '_objectNumberArrayInput', required: false },
          { name: '_objectBooleanInput', required: false, type: '{ boolean: boolean; }' },
          { name: '_objectBooleanArrayInput', required: false },
          { name: '_objectMultipleInput', required: false },
          { name: '_string', required: false, type: 'string' },
          { name: '_stringArray', required: false },
        ],
        output: [
          {
            name: 'data',
            required: true,
            type: '{ booleanArrayOutput: {}; booleanOutput: boolean; numberArrayOutput: {}; numberOutput: number; objectBooleanArrayOutput: { booleanArray: {}; }; objectBooleanOutput: { boolean: boolean; }; objectMultipleOutput: { boolean: boolean; booleanArray: {}; number: number; numberArray: {}; object: { boolean: boolean; booleanArray: {}; number: number; numberArray: {}; string: string; stringArray: {}; }; objectArray: {}; string: string; stringArray: {}; }; objectNumberArrayOutput: { numberArray: {}; }; objectNumberOutput: { number: number; }; objectStringArrayOutput: { stringArray: {}; }; objectStringOutput: { string: string; }; stringArrayOutput: {}; stringOutput: string; }',
          },
          ...messageOutput,
        ],
        trpcPath: '/trpc/test._checkParams',
      },
      {
        httpPath: '/test/async-fail-reject',
        input: [],
        output: errorOutput,
        trpcPath: '/trpc/test.asyncFailReject',
      },
      {
        httpPath: '/test/async-fail-throw',
        input: [],
        output: errorOutput,
        trpcPath: '/trpc/test.asyncFailThrow',
      },
      {
        httpPath: '/test/async-success',
        input: [],
        output: messageOutput,
        trpcPath: '/trpc/test.asyncSuccess',
      },
      {
        httpPath: '/test/hello',
        input: [
          { name: 'firstName', required: true, type: 'string' },
          { name: 'lastName', required: false, type: 'string | undefined' },
        ],
        output: messageOutput,
        trpcPath: '/trpc/test.hello',
      },
      {
        httpPath: '/test/mixed-params',
        input: [
          { name: 'a', required: true, type: 'string' },
          { name: 'b', required: true, type: 'number' },
          { name: 'options', required: false, type: '{ bar?: number; foo?: string; } | undefined' },
          { name: 'arr', required: false },
        ],
        output: [
          {
            name: 'data',
            required: true,
            type: '{ a: string; arr: {} | undefined; b: number; options: { bar?: number; foo?: string; } | undefined; }',
          },
          ...messageOutput,
        ],
        trpcPath: '/trpc/test.mixedParams',
      },
      {
        httpPath: '/test/object-destructured',
        input: [
          { name: '{ prop1, prop2 }', required: true, type: '{ prop1?: string; prop2?: number; }' },
        ],
        output: [
          {
            name: 'data',
            required: true,
            type: '{ prop1: string | undefined; prop2: number | undefined; }',
          },
          ...messageOutput,
        ],
        trpcPath: '/trpc/test.objectDestructured',
      },
      {
        httpPath: '/test/object-only',
        input: [{ name: 'options', required: true, type: '{ bar?: number; foo?: string; }' }],
        output: [
          { name: 'data', required: true, type: '{ bar?: number; foo?: string; }' },
          ...messageOutput,
        ],
        trpcPath: '/trpc/test.objectOnly',
      },
      {
        httpPath: '/test/primitives-and-array',
        input: [
          { name: 'var1', required: true, type: 'string' },
          { name: 'var2', required: true, type: 'number' },
          { name: 'var3', required: false },
        ],
        output: [
          {
            name: 'data',
            required: true,
            type: '{ var1: string; var2: number; var3: {} | undefined; }',
          },
          ...messageOutput,
        ],
        trpcPath: '/trpc/test.primitivesAndArray',
      },
      {
        httpPath: '/test/sync-fail-reject',
        input: [],
        output: errorOutput,
        trpcPath: '/trpc/test.syncFailReject',
      },
      {
        httpPath: '/test/sync-fail-throw',
        input: [],
        output: errorOutput,
        trpcPath: '/trpc/test.syncFailThrow',
      },
      {
        httpPath: '/test/sync-success',
        input: [],
        output: messageOutput,
        trpcPath: '/trpc/test.syncSuccess',
      },
    ] as const;

    const expectedRoutes = [
      {
        input: [] as const,
        output: messageOutput,
        path: '/',
        requestType: 'HTTP' as const,
      },
      ...sharedRouteCases.map((c) => ({
        input: c.input,
        output: c.output,
        path: c.httpPath,
        requestType: 'HTTP' as const,
      })),
      {
        input: [] as const,
        output: messageOutput,
        path: '/trpc/default.root',
        requestType: 'tRPC' as const,
      },
      ...sharedRouteCases.map((c) => ({
        input: c.input,
        output: c.output,
        path: c.trpcPath,
        requestType: 'tRPC' as const,
      })),
    ];

    it.each(expectedRoutes)(
      'should match shape for $requestType $path',
      async ({ input, output, path, requestType }) => {
        const routes = await extractAllRoutes();
        const route = routes.find((r) => r.path === path && r.requestType === requestType);

        expect(route).toBeDefined();
        if (!route) {
          return;
        }

        const routeInput = route.input ?? [];
        for (const expectedParam of input) {
          const found = routeInput.find((p) => p.name === expectedParam.name);
          expect(found, `input param '${expectedParam.name}'`).toBeDefined();
          if (found) {
            if ('type' in expectedParam) {
              expect(found.type).toBe(expectedParam.type);
            }
            expect(found.required).toBe(expectedParam.required);
          }
        }

        const routeOutput = route.output ?? [];
        expect(routeOutput).toHaveLength(output.length);
        for (const expectedField of output) {
          const found = routeOutput.find((f) => f.name === expectedField.name);
          expect(found, `output field '${expectedField.name}'`).toBeDefined();
          if (found) {
            if ('type' in expectedField) {
              expect(found.type).toBe(expectedField.type);
            }
            expect(found.required).toBe(expectedField.required);
          }
        }
      },
    );

    it('should have no unknown output types across all routes', async () => {
      const routes = await extractAllRoutes();

      for (const route of routes) {
        if (route.output !== undefined) {
          for (const field of route.output) {
            expect(
              field.type,
              `Route ${route.path} output field '${field.name}' should not be unknown`,
            ).not.toBe('unknown');
          }
        }
      }
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
      const routes = await extractAllRoutes();
      expect(Array.isArray(routes)).toBe(true);
    });
  });
});
