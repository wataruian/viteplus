import type { MakeTrcpRequestOptions, TestEnvironment, TrpcTestCase } from '../src/types/testing';
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { getTrpcRoutes } from '../src/utils/autogen/discovery/trpc-discovery';
import request from 'supertest';
import { transformer } from '../src/utils/trpc';
import { trpcEndpoint } from '@lightproject/common/configs';

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
        message: 'Async success',
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
        message: 'Sync success',
        success: true,
      },
      path: 'test.syncSuccess',
      type: 'query',
    },
    {
      description: `GET ${trpcEndpoint} returns 200`,
      expected: {
        code: 200,
        message: 'OK',
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
      description: `POST ${trpcEndpoint}/test.hello returns 200`,
      expected: {
        code: 200,
        message: 'Hello, Test World!',
        success: true,
      },
      input: { firstName: 'Test', lastName: 'World' },
      path: 'test.hello',
      type: 'mutation',
    },
    {
      description: `POST ${trpcEndpoint}/test.primitivesAndArray returns correct array`,
      expected: {
        code: 200,
        data: {
          var1: 'foo',
          var2: 42,
          var3: ['a', 'b'],
        },
        message: 'Primitives and array processed successfully',
        success: true,
      },
      input: { var1: 'foo', var2: 42, var3: ['a', 'b'] },
      path: 'test.primitivesAndArray',
      type: 'mutation',
    },
    {
      description: `POST ${trpcEndpoint}/test.objectOnly returns correct object`,
      expected: {
        code: 200,
        data: { bar: 1, foo: 'baz' },
        message: 'Object parameters processed successfully',
        success: true,
      },
      input: { bar: 1, foo: 'baz' },
      path: 'test.objectOnly',
      type: 'mutation',
    },
    {
      description: `POST ${trpcEndpoint}/test.objectDestructured returns correct object`,
      expected: {
        code: 200,
        data: { prop1: 'hello', prop2: 99 },
        message: 'Object destructured parameters processed successfully',
        success: true,
      },
      input: { prop1: 'hello', prop2: 99 },
      path: 'test.objectDestructured',
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
        message: 'Mixed parameters processed successfully',
        success: true,
      },
      input: { a: 'x', arr: [1, 2], b: 7, options: { bar: 2, foo: 'y' } },
      path: 'test.mixedParams',
      type: 'mutation',
    },
  ],
};

const runTests = (env: TestEnvironment, testCases: TrpcTestCase[]) => {
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
            expect(jsonData).toMatchObject({
              code: expected.code,
              message: expected.message,
              success: expected.success,
            });

            const jsonDataData = Reflect.get(jsonData, 'data') as unknown;
            if (
              jsonDataData !== undefined &&
              jsonDataData !== null &&
              expected.data !== undefined &&
              expected.data !== null
            ) {
              expect(jsonDataData).toMatchObject(expected.data as object);
            }

            const jsonDataError = Reflect.get(jsonData, 'error') as unknown;
            if (jsonDataError !== undefined && jsonDataError !== null) {
              expect(typeof jsonDataError).toBe('object');
            }

            const jsonDataSessionId = Reflect.get(jsonData, 'sessionId') as unknown;
            if (jsonDataSessionId !== undefined && jsonDataSessionId !== null) {
              expect(typeof jsonDataSessionId).toBe('string');
            }
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
    const routes = await getTrpcRoutes();

    // Find routes with service methods
    const serviceRoutes = routes.filter(
      (r) =>
        r.serviceClass !== undefined &&
        r.serviceClass !== '' &&
        r.serviceMethod !== undefined &&
        r.serviceMethod !== '',
    );

    expect(serviceRoutes.length).toBeGreaterThan(0);

    // Verify each service route has output schema
    for (const route of serviceRoutes) {
      expect(route.output).toBeDefined();
      expect(Array.isArray(route.output)).toBe(true);

      if (route.output && route.output.length > 0) {
        for (const output of route.output) {
          expect(output).toHaveProperty('name');
          expect(output).toHaveProperty('type');
          expect(output).toHaveProperty('description');
          expect(typeof output.type).toBe('string');
          expect(output.type.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should handle different output types in tRPC routes', async () => {
    const routes = await getTrpcRoutes();

    // Collect all output types
    const outputTypes = new Set<string>();
    for (const route of routes) {
      if (route.output && route.output.length > 0) {
        for (const output of route.output) {
          outputTypes.add(output.type);
        }
      }
    }

    // Verify we have multiple output types
    expect(outputTypes.size).toBeGreaterThan(0);
  });
});
