import {
  docsEndpoint,
  docsHttpEndpoint,
  docsTrpcEndpoint,
  openApiHttpJsonEndpoint,
  openApiTrpcJsonEndpoint,
} from '@lightproject/common/configs';
import { afterAll, afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { runtimes } from './helpers/utils';

afterEach(() => {
  vi.unstubAllEnvs();
});

const docPaths = [
  docsEndpoint,
  docsHttpEndpoint,
  docsTrpcEndpoint,
  openApiHttpJsonEndpoint,
  openApiTrpcJsonEndpoint,
];

describe.each(runtimes)('on $name', ({ cleanup, importApp }) => {
  afterAll(cleanup);

  test('isLocal() ENV registers every doc/OpenAPI route', async () => {
    const app = await importApp({ ENV: 'local' });

    const expectedCode = 200;

    await Promise.all(
      docPaths.map(async (path) => {
        const res = await app.request(path);
        expect(res.status, `expected successful response for ${path}`).toBe(expectedCode);
      }),
    );
  });

  test('a non-local ENV never registers the doc/OpenAPI routes', async () => {
    const app = await importApp({ ENV: 'test' });

    const expectedCode = 404;

    await Promise.all(
      docPaths.map(async (path) => {
        const res = await app.request(path);
        expect(res.status, `expected error response for ${path}`).toBe(expectedCode);
        const body: unknown = await res.json();
        expect(body).toMatchObject({ error: { code: 'NOT_FOUND', statusCode: expectedCode } });
      }),
    );
  });

  test('regular routes keep working regardless of doc-route availability', async () => {
    const localApp = await importApp({ ENV: 'local' });
    const testApp = await importApp({ ENV: 'test' });

    const expectedCode = 200;

    await Promise.all(
      [localApp, testApp].map(async (app) => {
        const httpRes = await app.request('/api/test/hello');
        const trpcRes = await app.request(
          `/trpc/test.hello?input=${encodeURIComponent(JSON.stringify({}))}`,
        );
        expect(httpRes.status).toBe(expectedCode);
        expect(trpcRes.status).toBe(expectedCode);
      }),
    );
  });
});
