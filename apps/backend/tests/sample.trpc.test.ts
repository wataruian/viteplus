import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import type { AppRouterPaths } from '../src/utils/trpc-router';
import type { RouteInfo } from '../src/middlewares/initialize-request';
import type { TRPCProcedureType } from '@trpc/server';
import { getTrpcRoutes } from '../src/utils/autogen/discovery';
import request from 'supertest';
import { transformer } from '../src/utils/trpc';
import { trpcEndpoint } from '@lightproject/common/configs';

interface MakeTrcpRequestOptions {
  env?: 'other-test' | 'test';
  input?: Record<string, unknown>;
  ip?: string;
  method?: 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put';
  path: AppRouterPaths | 'test.unknown';
  type: TRPCProcedureType;
}

interface TrpcTestCase {
  description?: string;
  endpoint?: string;
  env?: 'other-test' | 'test';
  expected: {
    code: number;
    data?: unknown;
    error?: unknown;
    message?: string | undefined;
    success: boolean;
    trpcError?: string | undefined;
  };
  input?: null | Record<string, unknown> | undefined;
  path: AppRouterPaths | 'test.unknown';
  type: TRPCProcedureType;
}

const makeRequest = async ({ input = {}, path, type }: MakeTrcpRequestOptions) => {
  const method = type === 'query' ? 'get' : 'post';

  if (path === undefined) {
    throw new Error('Path is required');
  }

  const normalizedEndpoint = path.startsWith(trpcEndpoint)
    ? (path.startsWith('/') ? '' : '/') + path
    : `${trpcEndpoint}${path.startsWith('/') ? '' : '/'}${path}`;

  const { createTestApp } = await import('../src/main');
  const app = createTestApp();

  const req = request(await app)[method](normalizedEndpoint);

  req.set('Content-Type', 'application/json');
  req.set('Accept', 'application/json');
  req.buffer(true);

  if (method === 'get') {
    if (Object.keys(input).length > 0) {
      req.query({ input: transformer.stringify(input) });
    }
  } else {
    req.send({ json: input });
  }

  return req;
};

const cases: Record<string, TrpcTestCase[]> = {
  'has access': [
    {
      description: `GET ${trpcEndpoint}/test.asyncFailReject returns 500`,
      expected: {
        code: 500,
        message: 'Async error. Simulated promise rejection',
        success: false,
      },
      path: 'test.asyncFailReject',
      type: 'query',
    },
    {
      description: `GET ${trpcEndpoint}/test.asyncFailThrow returns 500`,
      expected: {
        code: 500,
        message: 'Async error. Simulated throwing exception',
        success: false,
      },
      path: 'test.asyncFailThrow',
      type: 'query',
    },
    {
      description: `GET ${trpcEndpoint}/test.asyncSuccess returns 200`,
      expected: {
        code: 200,
        data: { customMessage: 'Async success' },
        success: true,
      },
      path: 'test.asyncSuccess',
      type: 'query',
    },
    {
      description: `GET ${trpcEndpoint}/test.syncFailReject returns 500`,
      expected: {
        code: 500,
        message: 'Sync error. Simulated promise rejection',
        success: false,
      },
      path: 'test.syncFailReject',
      type: 'query',
    },
    {
      description: `GET ${trpcEndpoint}/test.syncFailThrow returns 500`,
      expected: {
        code: 500,
        message: 'Sync error. Simulated throwing exception',
        success: false,
      },
      path: 'test.syncFailThrow',
      type: 'query',
    },
    {
      description: `GET ${trpcEndpoint}/test.syncSuccess returns 200`,
      expected: {
        code: 200,
        data: { customMessage: 'Sync success' },
        success: true,
      },
      path: 'test.syncSuccess',
      type: 'query',
    },
    {
      description: `GET ${trpcEndpoint} returns 200`,
      expected: {
        code: 200,
        data: { customMessage: 'OK' },
        success: true,
      },
      path: 'default.root',
      type: 'query',
    },
    {
      description: `GET ${trpcEndpoint}/test.unknown returns 404`,
      expected: {
        code: 404,
        message: 'Not Found',
        success: false,
      },
      path: 'test.unknown',
      type: 'query',
    },
  ],
  'no access': [
    {
      description: `GET ${trpcEndpoint}/test.syncSuccess returns 403`,
      env: 'other-test',
      expected: {
        code: 403,
        message: 'Access denied',
        success: false,
      },
      path: 'test.syncSuccess',
      type: 'query',
    },
  ],
  'test param endpoints': [
    {
      description: `POST ${trpcEndpoint}/test.checkParams returns correct output`,
      expected: {
        code: 200,
        data: {
          boolean: true,
          booleanArray: [true, false],
          number: 123,
          numberArray: [123, 456],
          objectBoolean: { boolean: true },
          objectBooleanArray: { booleanArray: [true, false] },
          objectMultiple: {
            boolean: false,
            booleanArray: [true, false],
            number: 123,
            numberArray: [123, 456],
            object: {
              boolean: true,
              booleanArray: [true, false],
              number: 123,
              numberArray: [123, 456],
              string: 'ABC',
              stringArray: ['ABC', 'DEF'],
            },
            objectArray: [
              {
                boolean: true,
                booleanArray: [true, false],
                number: 123,
                numberArray: [123, 456],
                string: 'ABC',
                stringArray: ['ABC', 'DEF'],
              },
              {
                boolean: false,
                booleanArray: [false, true],
                number: 456,
                numberArray: [456, 789],
                string: 'DEF',
                stringArray: ['DEF', 'GHI'],
              },
            ],
            string: 'ABC',
            stringArray: ['ABC', 'DEF'],
          },
          objectNumber: { number: 123 },
          objectNumberArray: { numberArray: [123, 456] },
          objectString: { string: 'ABC' },
          objectStringArray: { stringArray: ['ABC', 'DEF'] },
          string: 'ABC',
          stringArray: ['ABC', 'DEF'],
        },
        success: true,
      },
      path: 'test.checkParams',
      type: 'mutation',
    },
    {
      description: `POST ${trpcEndpoint}/test.hello returns 200`,
      expected: {
        code: 200,
        data: { customMessage: 'Hello, Test World!' },
        success: true,
      },
      input: { firstName: 'Test', lastName: 'World' },
      path: 'test.hello',
      type: 'mutation',
    },
    {
      description: `POST ${trpcEndpoint}/test.mixedParams returns correct array`,
      expected: {
        code: 200,
        data: {
          a: 'x',
          arr: [1, 2],
          b: 7,
          options: { bar: 2, foo: 'y' },
        },
        success: true,
      },
      input: { a: 'x', arr: [1, 2], b: 7, options: { bar: 2, foo: 'y' } },
      path: 'test.mixedParams',
      type: 'mutation',
    },
    {
      description: `POST ${trpcEndpoint}/test.objectDestructured returns correct object`,
      expected: {
        code: 200,
        data: { prop1: 'hello', prop2: 99 },
        success: true,
      },
      input: { prop1: 'hello', prop2: 99 },
      path: 'test.objectDestructured',
      type: 'mutation',
    },
    {
      description: `POST ${trpcEndpoint}/test.objectOnly returns correct object`,
      expected: {
        code: 200,
        data: { options: { bar: 123, foo: 'ABC' } },
        success: true,
      },
      input: { options: { bar: 1, foo: 'baz' } },
      path: 'test.objectOnly',
      type: 'mutation',
    },
    {
      description: `POST ${trpcEndpoint}/test.primitivesAndArray returns correct array`,
      expected: {
        code: 200,
        data: {
          var1: 'foo',
          var2: 42,
          var3: ['ABC', 'DEF'],
        },
        success: true,
      },
      input: { var1: 'foo', var2: 42, var3: ['a', 'b'] },
      path: 'test.primitivesAndArray',
      type: 'mutation',
    },
    {
      description: `POST ${trpcEndpoint}/test.customTypeArray returns correct structure`,
      expected: {
        code: 200,
        data: {
          testUsers: [
            {
              address: {
                city: 'Sample',
                houseNumber: 1,
                province: 'Sample',
              },
              age: 25,
              firstName: 'First',
              lastName: 'Last',
            },
          ],
        },
        success: true,
      },
      input: {
        testUsers: [
          {
            address: {
              city: 'Sample',
              houseNumber: 1,
              province: 'Sample',
            },
            age: 25,
            firstName: 'First',
            lastName: 'Last',
          },
        ],
      },
      path: 'test.customTypeArray',
      type: 'mutation',
    },
    {
      description: `POST ${trpcEndpoint}/test.customTypeSingle returns correct structure`,
      expected: {
        code: 200,
        data: {
          testUser: {
            address: {
              city: 'Sample',
              houseNumber: 1,
              province: 'Sample',
            },
            age: 25,
            firstName: 'First',
            lastName: 'Last',
          },
        },
        success: true,
      },
      input: {
        testUser: {
          address: {
            city: 'Sample',
            houseNumber: 1,
            province: 'Sample',
          },
          age: 25,
          firstName: 'First',
          lastName: 'Last',
        },
      },
      path: 'test.customTypeSingle',
      type: 'mutation',
    },
    {
      description: `GET ${trpcEndpoint}/test.getWithParam returns 200`,
      expected: {
        code: 200,
        data: { customMessage: 'Hello, Test World!' },
        success: true,
      },
      input: { firstName: 'Test', lastName: 'World' },
      path: 'test.getWithParam',
      type: 'query',
    },
  ],
};

const runTests = (env: 'other-test' | 'test', testCases: TrpcTestCase[]) => {
  beforeAll(() => {
    let blockAllIps = false;
    if (env === 'other-test') {
      blockAllIps = true;
    }
    vi.stubEnv('BLOCK_ALL_IPS', blockAllIps.toString());
  });

  for (const testCase of testCases) {
    const { expected, input, path, type } = testCase;
    const method = type === 'query' ? 'get' : 'post';

    const titleEndpoint = `${trpcEndpoint}/${path}`;

    it(`should handle ${method.toUpperCase()} ${titleEndpoint}`, async () => {
      const response = await makeRequest({
        input: input ?? {},
        path,
        type,
      });

      expect(response.status).toBe(expected.code);

      const body = response.body as unknown;
      if (typeof body !== 'object' || body === null) {
        throw new Error('Response body is not an object');
      }

      const result = Reflect.get(body, 'result') as unknown;
      if (expected.success) {
        expect(result).toBeDefined();
      }

      if (typeof result === 'object' && result !== null) {
        const resultData = Reflect.get(result, 'data') as unknown;
        if (typeof resultData === 'object' && resultData !== null) {
          const jsonData = Reflect.get(resultData, 'json') as unknown;
          if (typeof jsonData === 'object' && jsonData !== null) {
            const matchObject: { code: number; message?: string; success: boolean } = {
              code: expected.code,
              success: expected.success,
            };
            if (expected.message !== undefined) {
              matchObject.message = expected.message;
            }
            expect(jsonData).toMatchObject(matchObject);

            const jsonDataData = Reflect.get(jsonData, 'data') as unknown;
            if (
              jsonDataData !== undefined &&
              jsonDataData !== null &&
              expected.data !== undefined &&
              expected.data !== null
            ) {
              expect(jsonDataData).toMatchObject(expected.data);
            }

            const jsonDataError = Reflect.get(jsonData, 'error') as unknown;
            if (jsonDataError !== undefined && jsonDataError !== null) {
              expect(typeof jsonDataError).toBe('object');
            }

            const jsonDataSessionId = Reflect.get(jsonData, 'sessionId') as unknown;
            expect(typeof jsonDataSessionId).toBe('string');
          }
        }
      }
    });
  }
};

describe('tRPC', () => {
  describe('has access', () => {
    runTests('test', cases['has access'] ?? []);
  });

  describe('no access', () => {
    runTests('other-test', cases['no access'] ?? []);
  });

  describe('test param endpoints', () => {
    runTests('test', cases['test param endpoints'] ?? []);
  });
});

describe('tRPC Output Schema', () => {
  it('should have output schemas extracted for tRPC routes', async () => {
    const routes: RouteInfo[] = await getTrpcRoutes();

    const serviceRoutes = routes.filter(
      (r) =>
        r.serviceClass !== undefined &&
        r.serviceClass !== '' &&
        r.serviceMethod !== undefined &&
        r.serviceMethod !== '',
    );

    expect(serviceRoutes.length).toBeGreaterThan(0);

    for (const route of serviceRoutes) {
      expect(route.output).toBeDefined();
      const { output } = route;

      if (output) {
        expect(output).toHaveProperty('name');
        expect(output).toHaveProperty('type');
        expect(output).toHaveProperty('description');
        const typeStr = output.type;
        if (typeof typeStr === 'string') {
          expect(typeStr.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should handle different output types in tRPC routes', async () => {
    const routes: RouteInfo[] = await getTrpcRoutes();

    const outputTypes = new Set<string>();
    for (const route of routes) {
      if (route.output) {
        const { type: typeVal } = route.output;
        const typeStr = typeof typeVal === 'string' ? typeVal : JSON.stringify(typeVal);
        outputTypes.add(typeStr);
      }
    }

    expect(outputTypes.size).toBeGreaterThan(0);
  });
});
