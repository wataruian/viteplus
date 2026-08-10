import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { apiEndpoint } from '@lightproject/common/configs';
import { getHttpRoutes } from '../src/utils/autogen/discovery/http-discovery';
import request from 'supertest';

interface HttpTestCase {
  description?: string;
  endpoint: string;
  env?: 'other-test' | 'test';
  expected: {
    code: number;
    data?: unknown;
    error?: unknown;
    message?: string;
    success: boolean;
  };
  input?: null | Record<string, unknown>;
  method: 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put';
}

interface MakeHttpRequestOptions {
  endpoint: string;
  env?: 'other-test' | 'test';
  input?: Record<string, unknown>;
  ip?: string;
  method?: 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put';
}

const makeRequest = async ({ endpoint, input = {}, method = 'get' }: MakeHttpRequestOptions) => {
  const normalizedEndpoint = endpoint.startsWith(apiEndpoint)
    ? endpoint
    : `${apiEndpoint}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const { createTestApp } = await import('../src/main');
  const app = createTestApp();

  const req = request(await app)[method](normalizedEndpoint);

  if (method === 'get') {
    req.query(input);
  } else {
    req.send(input);
  }

  return req;
};

const cases: Record<string, HttpTestCase[]> = {
  'has access': [
    {
      description: `GET ${apiEndpoint}/test/async-fail-reject returns 500`,
      endpoint: `${apiEndpoint}/test/async-fail-reject`,
      expected: {
        code: 500,
        message: 'Async error. Simulated promise rejection',
        success: false,
      },
      method: 'get',
    },
    {
      description: `GET ${apiEndpoint}/test/async-fail-throw returns 500`,
      endpoint: `${apiEndpoint}/test/async-fail-throw`,
      expected: {
        code: 500,
        message: 'Async error. Simulated throwing exception',
        success: false,
      },
      method: 'get',
    },
    {
      description: `GET ${apiEndpoint}/test/async-success returns 200`,
      endpoint: `${apiEndpoint}/test/async-success`,
      expected: {
        code: 200,
        data: { customMessage: 'Async success' },
        success: true,
      },
      method: 'get',
    },
    {
      description: `GET ${apiEndpoint}/test/sync-fail-reject returns 500`,
      endpoint: `${apiEndpoint}/test/sync-fail-reject`,
      expected: {
        code: 500,
        message: 'Sync error. Simulated promise rejection',
        success: false,
      },
      method: 'get',
    },
    {
      description: `GET ${apiEndpoint}/test/sync-fail-throw returns 500`,
      endpoint: `${apiEndpoint}/test/sync-fail-throw`,
      expected: {
        code: 500,
        message: 'Sync error. Simulated throwing exception',
        success: false,
      },
      method: 'get',
    },
    {
      description: `GET ${apiEndpoint}/test/sync-success returns 200`,
      endpoint: `${apiEndpoint}/test/sync-success`,
      expected: {
        code: 200,
        data: { customMessage: 'Sync success' },
        success: true,
      },
      method: 'get',
    },
    {
      description: `GET ${apiEndpoint} returns 200`,
      endpoint: `${apiEndpoint}/`,
      expected: {
        code: 200,
        data: { customMessage: 'OK' },
        success: true,
      },
      method: 'get',
    },
    {
      description: `GET ${apiEndpoint}/test/unknown returns 404`,
      endpoint: `${apiEndpoint}/test/unknown`,
      expected: {
        code: 404,
        message: 'Not Found',
        success: false,
      },
      method: 'get',
    },
  ],
  'no access': [
    {
      description: `GET ${apiEndpoint}/test/sync-success returns 403`,
      endpoint: `${apiEndpoint}/test/sync-success`,
      env: 'other-test',
      expected: {
        code: 403,
        message: 'Access denied',
        success: false,
      },
      method: 'get',
    },
  ],
  'test param endpoints': [
    {
      description: `POST ${apiEndpoint}/test/check-params returns correct output`,
      endpoint: `${apiEndpoint}/test/check-params`,
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
      method: 'post',
    },
    {
      description: `POST ${apiEndpoint}/test/hello returns 200`,
      endpoint: `${apiEndpoint}/test/hello`,
      expected: {
        code: 200,
        data: { customMessage: 'Hello, Test World!' },
        success: true,
      },
      input: { firstName: 'Test', lastName: 'World' },
      method: 'post',
    },
    {
      description: `POST ${apiEndpoint}/test/mixed-params returns correct array`,
      endpoint: `${apiEndpoint}/test/mixed-params`,
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
      method: 'post',
    },
    {
      description: `POST ${apiEndpoint}/test/object-destructured returns correct object`,
      endpoint: `${apiEndpoint}/test/object-destructured`,
      expected: {
        code: 200,
        data: { prop1: 'hello', prop2: 99 },
        success: true,
      },
      input: { prop1: 'hello', prop2: 99 },
      method: 'post',
    },
    {
      description: `POST ${apiEndpoint}/test/object-only returns correct object`,
      endpoint: `${apiEndpoint}/test/object-only`,
      expected: {
        code: 200,
        data: { options: { bar: 123, foo: 'ABC' } },
        success: true,
      },
      input: { options: { bar: 1, foo: 'baz' } },
      method: 'post',
    },
    {
      description: `POST ${apiEndpoint}/test/primitives-and-array returns correct array`,
      endpoint: `${apiEndpoint}/test/primitives-and-array`,
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
      method: 'post',
    },
    {
      description: `POST ${apiEndpoint}/test/custom-type-array returns correct structure`,
      endpoint: `${apiEndpoint}/test/custom-type-array`,
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
      method: 'post',
    },
    {
      description: `POST ${apiEndpoint}/test/custom-type-single returns correct structure`,
      endpoint: `${apiEndpoint}/test/custom-type-single`,
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
      method: 'post',
    },
    {
      description: `GET ${apiEndpoint}/test/get-with-param returns 200`,
      endpoint: `${apiEndpoint}/test/get-with-param`,
      expected: {
        code: 200,
        data: { customMessage: 'Hello, Test World!' },
        success: true,
      },
      input: { firstName: 'Test', lastName: 'World' },
      method: 'get',
    },
  ],
};

const runTests = (env: 'other-test' | 'test', testCases: HttpTestCase[]) => {
  beforeAll(() => {
    let blockAllIps = false;
    if (env === 'other-test') {
      blockAllIps = true;
    }
    vi.stubEnv('BLOCK_ALL_IPS', blockAllIps.toString());
  });

  for (const testCase of testCases) {
    const { endpoint, expected, method } = testCase;
    const input = testCase.input ?? {};

    it(`should handle ${method.toUpperCase()} ${endpoint}`, async () => {
      const response = await makeRequest({
        endpoint,
        input,
        method,
      });

      expect(response.status).toBe(expected.code);
      const body = response.body as unknown;
      if (typeof body !== 'object' || body === null) {
        throw new Error('Response body is not an object');
      }

      const matchObject: { code: number; message?: string; success: boolean } = {
        code: expected.code,
        success: expected.success,
      };
      if (expected.message !== undefined) {
        matchObject.message = expected.message;
      }
      expect(body).toMatchObject(matchObject);

      if ('data' in expected && expected.data !== undefined && expected.data !== null) {
        expect(Reflect.get(body, 'data')).toEqual(expect.objectContaining(expected.data));
      }

      if ('error' in expected && expected.error !== undefined && expected.error !== null) {
        expect(Reflect.get(body, 'error')).toMatchObject(expected.error);
      }

      expect(typeof Reflect.get(body, 'sessionId')).toBe('string');
    });
  }
};

describe('HTTP', () => {
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

describe('HTTP Output Schema', () => {
  it('should have output schemas extracted for HTTP routes', async () => {
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

  it('should handle different output types in routes', async () => {
    const routes = await getHttpRoutes();

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
