import { z } from '@hono/zod-openapi';
import { openApiVersion } from '@lightproject/common/configs';
import { Hono } from 'hono';
import { afterAll, describe, expect, test } from 'vite-plus/test';

import { apiRouter } from '../../src/routers/http';
import {
  type HttpEnv,
  type HttpRoute,
  assertHttpRoutesDocumented,
  createHttpRouter,
  defineHttpRoute,
} from '../../src/routers/utils';
import { DefaultService } from '../../src/services/default';
import { TestService } from '../../src/services/test';
import { httpEnvelope, runtimes } from '../helpers/utils';

const openApiDocShape = z.object({
  components: z.object({ schemas: z.record(z.string(), z.unknown()) }),
  info: z.object({ title: z.string(), version: z.string() }),
  openapi: z.string(),
  paths: z.record(z.string(), z.record(z.string(), z.unknown())),
});

const successCode = 200;

test('every registered HTTP route is discoverable for OpenAPI generation', () => {
  expect(() => {
    assertHttpRoutesDocumented(apiRouter);
  }).not.toThrow();
});

test('a route registered without going through defineHttpRoute throws instead of silently vanishing from the docs', () => {
  const router = createHttpRouter([
    defineHttpRoute({
      handlerFn: DefaultService.root,
      method: 'get',
      path: '/root',
    }),
  ]);

  router.get('/broken', (c) => c.json({ ok: true }));

  expect(() => {
    assertHttpRoutesDocumented(router);
  }).toThrow(/\/broken/u);
});

test('defineHttpRoute falls back to the handler request schema for parsing when a schema override omits one', async () => {
  const overrideResponseSchema = z.object({ id: z.string() });

  const route = defineHttpRoute({
    handlerFn: TestService.profile,
    method: 'post',
    path: '/profile-override',
    schema: { response: overrideResponseSchema },
  });

  expect(route.schema.request).toBeUndefined();

  const result = await route.handle({
    age: 42,
    name: 'Sample User',
    preferences: { notifications: false, theme: 'light' },
    tags: ['sample'],
  });

  expect(result).toMatchObject({ id: 'profile_sample-user' });
});

test('createHttpRouter builds a requestless route when a route has no request schema at all', async () => {
  const responseSchema = z.object({ ping: z.string() });
  const route: HttpRoute = {
    handle: () => ({ ping: 'pong' }),
    method: 'get',
    path: '/ping',
    schema: { response: responseSchema },
  };

  const router = createHttpRouter([route]);
  const app = new Hono<HttpEnv>();
  app.use('*', async (c, next) => {
    c.set('sessionId', 'unit-test-session');
    await next();
  });
  app.route('/', router);

  const res = await app.request('/ping');

  expect(res.status).toBe(successCode);
  const body: unknown = await res.json();
  expect(httpEnvelope(responseSchema).parse(body).data).toStrictEqual({ ping: 'pong' });
});

describe.each(runtimes)('on $name', ({ cleanup, importApp }) => {
  afterAll(cleanup);

  test('the generated HTTP OpenAPI document is served at /docs/openapi-http.json and documents every route', async () => {
    const app = await importApp();
    const res = await app.request('/docs/openapi-http.json');

    expect(res.status).toBe(successCode);
    const doc = openApiDocShape.parse(await res.json());

    expect(doc.openapi).toBe(openApiVersion);
    expect(doc.info.title).toBe('HTTP OpenAPI');

    const pathKeys = Object.keys(doc.paths);
    for (const path of ['/api', '/api/test/hello', '/api/test/profile']) {
      expect(pathKeys).toContain(path);
    }
    expect(Object.keys(doc.paths['/api'] ?? {})).toContain('get');
    expect(Object.keys(doc.paths['/api/test/hello'] ?? {})).toContain('get');
    expect(Object.keys(doc.paths['/api/test/profile'] ?? {})).toContain('post');

    const schemaNames = Object.keys(doc.components.schemas);
    for (const name of ['RootResponse', 'HelloResponse', 'CreateProfileResponse']) {
      expect(schemaNames).toContain(name);
    }
  });

  test('the Swagger UI page for the HTTP docs is reachable', async () => {
    const app = await importApp();
    const res = await app.request('/docs/http');

    expect(res.status).toBe(successCode);
    expect(res.headers.get('content-type')).toMatch(/text\/html/u);
  });

  const httpSampleRequests: Record<
    string,
    {
      url: string;
      init?: { body?: string; headers?: Record<string, string>; method?: string };
      validate: (data: unknown) => void;
    }
  > = {
    'GET /api/': {
      url: '/api',
      validate: (data) => {
        httpEnvelope(DefaultService.root.schema.response).parse(data);
      },
    },
    'GET /api/test/hello': {
      url: '/api/test/hello?name=Sample',
      validate: (data) => {
        httpEnvelope(TestService.hello.schema.response).parse(data);
      },
    },
    'POST /api/test/profile': {
      init: {
        body: JSON.stringify({
          age: 42,
          name: 'Sample User',
          preferences: { notifications: false, theme: 'light' },
          tags: ['sample'],
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
      url: '/api/test/profile',
      validate: (data) => {
        httpEnvelope(TestService.profile.schema.response).parse(data);
      },
    },
  };

  test('every registered HTTP route has a working sample request that matches its documented response schema', async () => {
    const uniqueRoutes = new Set(apiRouter.routes.map((route) => `${route.method} ${route.path}`));
    expect(Object.keys(httpSampleRequests)).toHaveLength(uniqueRoutes.size);

    const app = await importApp();

    await Promise.all(
      Object.entries(httpSampleRequests).map(async ([key, sample]) => {
        const res = await app.request(sample.url, sample.init);
        expect(res.status, `expected ${key} to succeed`).toBe(successCode);
        const body: unknown = await res.json();
        expect(() => {
          sample.validate(body);
        }, `expected ${key}'s response to match its documented schema`).not.toThrow();
      }),
    );
  });
});
