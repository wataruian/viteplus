import { describe, expect, it } from 'vite-plus/test';
import { extractAllRoutes } from '../../src/utils/autogen';
import { isParsedType } from '../../src/utils/autogen/generators/openapi-generator';

const formatTypeToString = (type: unknown): string => {
  if (typeof type === 'string') {
    return type;
  }
  if (type === undefined || type === null || typeof type !== 'object') {
    return 'unknown';
  }
  if (isParsedType(type)) {
    switch (type.kind) {
      case 'primitive': {
        return type.base ?? 'unknown';
      }
      case 'array': {
        return `${formatTypeToString(type.itemType)}[]`;
      }
      case 'union': {
        const unionTypes = type.types ?? [];
        return unionTypes.map((t) => formatTypeToString(t)).join(' | ');
      }
      case 'object': {
        const properties = type.properties ?? {};
        const props = Object.entries(properties).map(([k, v]) => {
          const isOptional = typeof v === 'object' && 'required' in v && !(v.required ?? true);
          return `${k}${isOptional ? '?' : ''}: ${formatTypeToString(v)}`;
        });
        return `{ ${props.join('; ')} }`;
      }
      default: {
        return 'unknown';
      }
    }
  }
  return 'unknown';
};

const normalizeType = (str: string): string =>
  str
    .replaceAll(/\s+/gu, '')
    .replaceAll('\\', '')
    .replaceAll('|undefined', '')
    .replaceAll('?:', ':')
    .replaceAll(';', '')
    .replaceAll(',', '');

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
        expect(route.serviceClass).toMatch(/Service$/u);
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

      const routesWithOutput = routes.filter((r) => r.output !== undefined);

      expect(routesWithOutput.length).toBeGreaterThan(0);

      for (const route of routesWithOutput) {
        const field = route.output;
        expect(field).toBeDefined();
        if (field) {
          expect(field).toHaveProperty('name');
          expect(field).toHaveProperty('type');
          expect(field.type).not.toBe('unknown');
        }
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
        expect(route.handlerFilePath).toMatch(/\.ts$/u);
      }
    });

    it('should provide service file path information', async () => {
      const routes = await extractAllRoutes();

      const routesWithServiceFile = routes.filter(
        (r) => r.serviceFilePath !== undefined && r.serviceFilePath !== '',
      );

      expect(routesWithServiceFile.length).toBeGreaterThan(0);

      for (const route of routesWithServiceFile) {
        expect(route.serviceFilePath).toMatch(/\.ts$/u);
        expect(route.serviceFilePath).toMatch(/services/u);
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
    const baseOutput = [
      { name: 'code', required: true, type: 'number' },
      {
        name: 'error',
        required: false,
        type: '{ message: string; name: string; stack?: string; statusCode: number; }',
      },
      { name: 'message', required: false, type: 'string' },
      { name: 'sessionId', required: true, type: 'string' },
      { name: 'success', required: true, type: 'boolean' },
    ] as const;

    const voidOutput = [{ name: 'data', required: false, type: 'void' }, ...baseOutput] as const;

    const sharedRouteCases = [
      {
        httpPath: '/test/check-params',
        input: [
          { name: 'boolean', required: false, type: 'boolean' },
          { name: 'booleanArray', required: false, type: 'boolean\\[\\]' },
          { name: 'number', required: false, type: 'number' },
          { name: 'numberArray', required: false, type: 'number\\[\\]' },
          { name: 'objectBoolean', required: false, type: '{ boolean: boolean; }' },
          { name: 'objectBooleanArray', required: false },
          { name: 'objectMultiple', required: false },
          { name: 'objectNumber', required: false, type: '{ number: number; }' },
          { name: 'objectNumberArray', required: false },
          { name: 'objectString', required: false, type: '{ string: string; }' },
          { name: 'objectStringArray', required: false },
          { name: 'string', required: false, type: 'string' },
          { name: 'stringArray', required: false, type: 'string\\[\\]' },
        ],
        output: [
          {
            name: 'data',
            required: false,
            type: '{ boolean: boolean; booleanArray: boolean\\[\\]; number: number; numberArray: number\\[\\]; objectBoolean: { boolean: boolean; }; objectBooleanArray: { booleanArray: boolean\\[\\]; }; objectMultiple: { boolean: boolean; booleanArray: boolean\\[\\]; number: number; numberArray: number\\[\\]; object: { boolean: boolean; booleanArray: boolean\\[\\]; number: number; numberArray: number\\[\\]; string: string; stringArray: string\\[\\]; }; objectArray: { boolean: boolean; booleanArray: boolean\\[\\]; number: number; numberArray: number\\[\\]; string: string; stringArray: string\\[\\]; }\\[\\]; string: string; stringArray: string\\[\\]; }; objectNumber: { number: number; }; objectNumberArray: { numberArray: number\\[\\]; }; objectString: { string: string; }; objectStringArray: { stringArray: string\\[\\]; }; string: string; stringArray: string\\[\\]; }',
          },
          ...baseOutput,
        ],
        trpcPath: '/trpc/test.checkParams',
      },
      {
        httpPath: '/test/async-fail-reject',
        input: [],
        output: voidOutput,
        trpcPath: '/trpc/test.asyncFailReject',
      },
      {
        httpPath: '/test/async-fail-throw',
        input: [],
        output: voidOutput,
        trpcPath: '/trpc/test.asyncFailThrow',
      },
      {
        httpPath: '/test/async-success',
        input: [],
        output: [
          { name: 'data', required: false, type: '{ customMessage: string; }' },
          ...baseOutput,
        ],
        trpcPath: '/trpc/test.asyncSuccess',
      },
      {
        httpPath: '/test/hello',
        input: [
          { name: 'firstName', required: true, type: 'string' },
          { name: 'lastName', required: false, type: 'string | undefined' },
        ],
        output: [
          { name: 'data', required: false, type: '{ customMessage: string; }' },
          ...baseOutput,
        ],
        trpcPath: '/trpc/test.hello',
      },
      {
        httpPath: '/test/get-with-param',
        input: [
          { name: 'firstName', required: true, type: 'string' },
          { name: 'lastName', required: false, type: 'string | undefined' },
        ],
        output: [
          { name: 'data', required: false, type: '{ customMessage: string; }' },
          ...baseOutput,
        ],
        trpcPath: '/trpc/test.getWithParam',
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
            required: false,
            type: '{ a: string; arr: number\\[\\] | undefined; b: number; options: { bar?: number; foo?: string; } | undefined; }',
          },
          ...baseOutput,
        ],
        trpcPath: '/trpc/test.mixedParams',
      },
      {
        httpPath: '/test/object-destructured',
        input: [
          { name: 'prop1', required: true, type: 'string' },
          { name: 'prop2', required: true, type: 'number' },
        ],
        output: [
          {
            name: 'data',
            required: false,
            type: '{ prop1: string; prop2: number; }',
          },
          ...baseOutput,
        ],
        trpcPath: '/trpc/test.objectDestructured',
      },
      {
        httpPath: '/test/object-only',
        input: [{ name: 'options', required: true, type: '{ bar?: number; foo?: string; }' }],
        output: [
          { name: 'data', required: false, type: '{ options: { bar?: number; foo?: string; } }' },
          ...baseOutput,
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
            required: false,
            type: '{ var1: string; var2: number; var3: string[] | undefined; }',
          },
          ...baseOutput,
        ],
        trpcPath: '/trpc/test.primitivesAndArray',
      },
      {
        httpPath: '/test/sync-fail-reject',
        input: [],
        output: voidOutput,
        trpcPath: '/trpc/test.syncFailReject',
      },
      {
        httpPath: '/test/sync-fail-throw',
        input: [],
        output: voidOutput,
        trpcPath: '/trpc/test.syncFailThrow',
      },
      {
        httpPath: '/test/sync-success',
        input: [],
        output: [
          { name: 'data', required: false, type: '{ customMessage: string; }' },
          ...baseOutput,
        ],
        trpcPath: '/trpc/test.syncSuccess',
      },
      {
        httpPath: '/test/custom-type-array',
        input: [{ name: 'testUsers', required: false }],
        output: [{ name: 'data', required: false }, ...baseOutput],
        trpcPath: '/trpc/test.customTypeArray',
      },
      {
        httpPath: '/test/custom-type-single',
        input: [{ name: 'testUser', required: false }],
        output: [{ name: 'data', required: false }, ...baseOutput],
        trpcPath: '/trpc/test.customTypeSingle',
      },
    ] as const;

    const expectedRoutes = [
      {
        input: [] as const,
        output: [
          { name: 'data', required: false, type: '{ customMessage: string; }' },
          ...baseOutput,
        ] as const,
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
        output: [
          { name: 'data', required: false, type: '{ customMessage: string; }' },
          ...baseOutput,
        ] as const,
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
          let expectedName: string = expectedParam.name;
          if (expectedName.startsWith('{') && expectedName.endsWith('}')) {
            expectedName = 'payload';
          }
          const found = routeInput.find((p) => p.name === expectedName);
          expect(found, `input param '${expectedParam.name}'`).toBeDefined();
          if (found !== undefined) {
            if ('type' in expectedParam) {
              const formattedFoundType = formatTypeToString(found.type);
              expect(normalizeType(formattedFoundType)).toBe(normalizeType(expectedParam.type));
            }
            expect(found.required).toBe(expectedParam.required);
          }
        }

        const { output: routeOutput } = route;
        expect(routeOutput).toBeDefined();

        if (routeOutput !== undefined) {
          const { type: typeVal } = routeOutput;
          expect(typeof typeVal).toBe('object');
          expect(typeVal).not.toBeNull();
          if (isParsedType(typeVal)) {
            const { properties } = typeVal;
            expect(properties).toBeDefined();
            expect(Object.keys(properties ?? {})).toHaveLength(output.length);

            for (const expectedField of output) {
              const found = properties?.[expectedField.name];
              expect(found, `output field '${expectedField.name}'`).toBeDefined();
              if (found !== undefined) {
                if ('type' in expectedField) {
                  const formattedFoundType = formatTypeToString(found);
                  expect(normalizeType(formattedFoundType)).toBe(normalizeType(expectedField.type));
                }
                if ('required' in expectedField) {
                  const isRequired =
                    typeof found === 'object' && 'required' in found
                      ? (found.required ?? true)
                      : true;
                  expect(isRequired).toBe(expectedField.required);
                }
              }
            }
          }
        }
      },
    );

    it('should have no unknown output types across all routes', async () => {
      const routes = await extractAllRoutes();

      for (const route of routes) {
        const { output } = route;
        if (output !== undefined) {
          const { type: outputType } = output;
          expect(outputType).not.toBe('unknown');
          if (isParsedType(outputType)) {
            const { properties } = outputType;
            if (properties) {
              for (const field of Object.values(properties)) {
                const fieldType = isParsedType(field) ? field.base : field;
                expect(fieldType).not.toBe('unknown');
              }
            }
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
