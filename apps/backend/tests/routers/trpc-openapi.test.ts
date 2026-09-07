import { z } from '@hono/zod-openapi';
import { openApiVersion, trpcUrl } from '@lightproject/common/configs';
import { afterAll, describe, expect, test } from 'vite-plus/test';

import { appRouter } from '../../src/routers/trpc';
import {
  collectTrpcOpenApiRoutes,
  createQuery,
  defineTrpcRoute,
  normalizeTrpcGetQuery,
  t,
} from '../../src/routers/utils';
import { DefaultService } from '../../src/services/default';
import { TestService } from '../../src/services/test';
import { runtimes, trpcEnvelope } from '../helpers/utils';

const openApiDocShape = z.object({
  components: z.object({ schemas: z.record(z.string(), z.unknown()) }),
  info: z.object({ title: z.string(), version: z.string() }),
  openapi: z.string(),
  paths: z.record(z.string(), z.record(z.string(), z.unknown())),
  servers: z.array(z.object({ url: z.string() })),
});

const trpcSampleInputs: Record<string, unknown> = {
  '/default.root': undefined,
  '/test.hello': { name: 'Sample' },
  '/test.profile': {
    age: 42,
    name: 'Sample User',
    preferences: { notifications: false, theme: 'light' },
    tags: ['sample'],
  },
};

const successCode = 200;

describe('normalizeTrpcGetQuery', () => {
  test('rewrites plain query params into a JSON input param', () => {
    const request = new globalThis.Request(`${trpcUrl}/test.hello?name=Foo`);

    const result = normalizeTrpcGetQuery(request, { name: 'Foo' });

    const resultUrl = new globalThis.URL(result.url);

    expect(resultUrl.searchParams.get('input')).toBe(JSON.stringify({ name: 'Foo' }));
    expect(resultUrl.searchParams.has('name')).toBe(false);
  });

  test('leaves the request untouched when an input= param is already present', () => {
    const request = new globalThis.Request(
      `${trpcUrl}/test.hello?input=${encodeURIComponent(JSON.stringify({ name: 'Foo' }))}`,
    );

    const result = normalizeTrpcGetQuery(request, { input: JSON.stringify({ name: 'Foo' }) });

    expect(result).toBe(request);
  });

  test('leaves the request untouched when there are no query params at all', () => {
    const request = new globalThis.Request(`${trpcUrl}/default.root`);
    const result = normalizeTrpcGetQuery(request, {});

    expect(result).toBe(request);
  });

  test('rewrites multiple query params into a single JSON input object', () => {
    const request = new globalThis.Request(`${trpcUrl}/test.profile?age=42&name=Foo`);
    const result = normalizeTrpcGetQuery(request, { age: '42', name: 'Foo' });

    const resultUrl = new globalThis.URL(result.url);

    expect(JSON.parse(resultUrl.searchParams.get('input') ?? '')).toStrictEqual({
      age: '42',
      name: 'Foo',
    });
  });
});

test('every registered tRPC procedure is discoverable for OpenAPI generation', () => {
  const openApiRoutes = collectTrpcOpenApiRoutes(appRouter);
  const registeredProcedureCount = Object.keys(appRouter._def.procedures).length;

  expect(openApiRoutes).toHaveLength(registeredProcedureCount);
});

test('a procedure built without route metadata throws instead of silently vanishing from the docs', () => {
  const mixedRouter = t.router({
    broken: t.procedure.query(() => ({ ok: true })),
    root: createQuery(
      defineTrpcRoute({
        handlerFn: DefaultService.root,
        inputOptional: true,
        method: 'get',
        path: '/default.root',
      }),
    ),
  });

  expect(() => collectTrpcOpenApiRoutes(mixedRouter)).toThrow(/broken/u);
});

describe.each(runtimes)('on $name', ({ cleanup, importApp }) => {
  afterAll(cleanup);

  test('the generated tRPC OpenAPI document is served at /docs/openapi-trpc.json and documents every procedure', async () => {
    const app = await importApp();
    const res = await app.request('/docs/openapi-trpc.json');

    expect(res.status).toBe(successCode);
    const doc = openApiDocShape.parse(await res.json());

    expect(doc.openapi).toBe(openApiVersion);
    expect(doc.info.title).toBe('tRPC OpenAPI');
    expect(doc.servers[0]?.url).toBe('/trpc');

    const pathKeys = Object.keys(doc.paths);
    for (const path of ['/default.root', '/test.hello', '/test.profile']) {
      expect(pathKeys).toContain(path);
    }
    expect(Object.keys(doc.paths['/default.root'] ?? {})).toContain('get');
    expect(Object.keys(doc.paths['/test.hello'] ?? {})).toContain('get');
    expect(Object.keys(doc.paths['/test.profile'] ?? {})).toContain('post');

    const schemaNames = Object.keys(doc.components.schemas);
    for (const name of ['RootResponse', 'HelloResponse', 'CreateProfileResponse']) {
      expect(schemaNames).toContain(name);
    }
  });

  test('the Swagger UI page for the tRPC docs is reachable', async () => {
    const app = await importApp();
    const res = await app.request('/docs/trpc');

    expect(res.status).toBe(successCode);
    expect(res.headers.get('content-type')).toMatch(/text\/html/u);
  });

  test('a plain query-string GET request (no explicit input= param) is rewritten into a tRPC input and produces the same result', async () => {
    const app = await importApp();

    const plainRes = await app.request('/trpc/test.hello?name=Plain');

    const explicitRes = await app.request(
      `/trpc/test.hello?input=${encodeURIComponent(JSON.stringify({ name: 'Plain' }))}`,
    );

    expect(plainRes.status).toBe(successCode);
    expect(explicitRes.status).toBe(successCode);

    const parsedPlain = trpcEnvelope(TestService.hello.schema.response).parse(
      await plainRes.json(),
    );

    const parsedExplicit = trpcEnvelope(TestService.hello.schema.response).parse(
      await explicitRes.json(),
    );

    expect(parsedPlain.result.data.data).toStrictEqual(parsedExplicit.result.data.data);
  });

  test('every registered tRPC procedure has a working sample request that matches its documented response schema', async () => {
    const routes = collectTrpcOpenApiRoutes(appRouter);
    expect(Object.keys(trpcSampleInputs)).toHaveLength(routes.length);

    const app = await importApp();

    await Promise.all(
      routes.map(async (route) => {
        const sample = trpcSampleInputs[route.path];
        const procedurePath = route.path.slice(1);

        const res =
          route.method === 'get'
            ? await app.request(
                `/trpc/${procedurePath}${
                  sample === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify(sample))}`
                }`,
              )
            : await app.request(`/trpc/${procedurePath}`, {
                body: JSON.stringify(sample),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
              });

        expect(res.status, `expected ${route.path} to succeed`).toBe(successCode);
        const body: unknown = await res.json();
        expect(() => {
          trpcEnvelope(route.schema.response).parse(body);
        }, `expected ${route.path}'s response to match its documented schema`).not.toThrow();
      }),
    );
  });
});
