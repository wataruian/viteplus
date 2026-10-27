import { afterAll, describe, expect, test } from 'vite-plus/test';

import { runtimes } from './helpers/utils';

const successCode = 200;
const notFoundCode = 404;

const postJson = { body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } };

describe.each(runtimes)('on $name with DISABLE_TEST_ROUTES=true', ({ cleanup, importApp }) => {
  afterAll(cleanup);

  test('the HTTP test routes are not served, the default ones still are', async () => {
    const app = await importApp({ DISABLE_TEST_ROUTES: 'true' });
    const root = await app.request('/api');
    const hello = await app.request('/api/test/hello');
    const ping = await app.request('/api/test/ping', { ...postJson, method: 'POST' });
    expect(root.status).toBe(successCode);
    expect(hello.status).toBe(notFoundCode);
    expect(ping.status).toBe(notFoundCode);
  });

  test('the tRPC test procedures are not served, the default ones still are', async () => {
    const app = await importApp({ DISABLE_TEST_ROUTES: 'true' });
    const root = await app.request('/trpc/default.root');
    const hello = await app.request('/trpc/test.hello');
    const createUser = await app.request('/trpc/test.createUser', { ...postJson, method: 'POST' });
    expect(root.status).toBe(successCode);
    expect(hello.status).toBe(notFoundCode);
    expect(createUser.status).toBe(notFoundCode);
  });

  test('the docs leave the test routes out', async () => {
    const app = await importApp({ DISABLE_TEST_ROUTES: 'true' });
    const http = await app.request('/docs/openapi-http.json');
    const trpc = await app.request('/docs/openapi-trpc.json');
    expect(await http.text()).not.toContain('/api/test/');
    expect(await trpc.text()).not.toContain('/test.');
  });
});
