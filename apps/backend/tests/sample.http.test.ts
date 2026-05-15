import type { HttpTestCase, MakeHttpRequestOptions, TestEnvironment } from '../src/types/testing';
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { apiEndpoint } from '@lightproject/common/configs';
import request from 'supertest';

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
        message: 'Async success',
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
        message: 'Sync success',
        success: true,
      },
      method: 'get',
    },
    {
      description: `GET ${apiEndpoint} returns 200`,
      endpoint: `${apiEndpoint}/`,
      expected: {
        code: 200,
        message: 'OK',
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
      description: `POST ${apiEndpoint}/test/hello returns 200`,
      endpoint: `${apiEndpoint}/test/hello`,
      expected: {
        code: 200,
        message: 'Hello, Test World!',
        success: true,
      },
      input: { firstName: 'Test', lastName: 'World' },
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
          var3: ['a', 'b'],
        },
        message: 'Primitives and array processed successfully',
        success: true,
      },
      input: { var1: 'foo', var2: 42, var3: ['a', 'b'] },
      method: 'post',
    },
    {
      description: `POST ${apiEndpoint}/test/object-only returns correct object`,
      endpoint: `${apiEndpoint}/test/object-only`,
      expected: {
        code: 200,
        data: { bar: 1, foo: 'baz' },
        message: 'Object parameters processed successfully',
        success: true,
      },
      input: { bar: 1, foo: 'baz' },
      method: 'post',
    },
    {
      description: `POST ${apiEndpoint}/test/object-destructured returns correct object`,
      endpoint: `${apiEndpoint}/test/object-destructured`,
      expected: {
        code: 200,
        data: { prop1: 'hello', prop2: 99 },
        message: 'Object destructured parameters processed successfully',
        success: true,
      },
      input: { prop1: 'hello', prop2: 99 },
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
        message: 'Mixed parameters processed successfully',
        success: true,
      },
      input: { a: 'x', arr: [1, 2], b: 7, options: { bar: 2, foo: 'y' } },
      method: 'post',
    },
  ],
};

const runTests = (env: TestEnvironment, testCases: HttpTestCase[]) => {
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

      expect(body).toMatchObject({
        code: expected.code,
        message: expected.message,
        success: expected.success,
      });

      if ('data' in expected && expected.data !== undefined && expected.data !== null) {
        expect(Reflect.get(body, 'data')).toEqual(expect.objectContaining(expected.data as object));
      }

      if ('error' in expected && expected.error !== undefined && expected.error !== null) {
        expect(Reflect.get(body, 'error')).toMatchObject(expected.error as object);
      }

      if ('sessionId' in expected) {
        expect(typeof Reflect.get(body, 'sessionId')).toBe('string');
      }
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
