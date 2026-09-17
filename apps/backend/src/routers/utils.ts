import { type Hook, OpenAPIHono, type RouteConfig, createRoute, z } from '@hono/zod-openapi';
import { openApiVersion, requestTypes } from '@lightproject/common/configs';
import { getSessionId } from '@lightproject/common/logger';
import { type AnyTRPCProcedure, initTRPC } from '@trpc/server';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import packageJson from '../../package.json' with { type: 'json' };
import type { AppEnv, ServiceFn } from '../schema';

type RouteMethod = 'get' | 'post' | 'put' | 'delete';

interface RouteDefinition<S extends z.ZodRawShape, O extends Record<string, unknown>> {
  handlerFn: ServiceFn<S, O>;
  inputOptional?: boolean;
  method: RouteMethod;
  path: `/${string}`;
  schema?: { request?: z.ZodObject<S>; response: z.ZodType<O> };
}

interface TrpcRouteMeta {
  method: RouteMethod;
  path: `/${string}`;
  schema: { request: z.ZodObject<z.ZodRawShape>; response: z.ZodType };
}

interface OpenApiRouteDefinition extends TrpcRouteMeta {
  tag: string;
}

interface TrpcProcedureTree {
  [key: string]: AnyTRPCProcedure | TrpcProcedureTree;
}

interface HttpRoute {
  handle: (input: unknown) => Record<string, unknown> | Promise<Record<string, unknown>>;
  method: RouteMethod;
  path: `/${string}`;
  schema: { request?: z.ZodObject<z.ZodRawShape>; response: z.ZodType };
}

interface TrpcRouterLike {
  _def: { record: TrpcProcedureTree };
}

type OpenApiRegistryDefinition = OpenAPIHono['openAPIRegistry']['definitions'][number];

const trpcRouteMethods: ReadonlySet<string> = new Set(['get', 'post', 'put', 'delete']);

const t = initTRPC.context<{ sessionId?: string }>().meta<TrpcRouteMeta>().create();

const createWrappedResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    code: z.number(),
    data: dataSchema,
    message: z.string(),
    sessionId: z.string(),
    success: z.boolean(),
  });

const defineTrpcRoute = <S extends z.ZodRawShape, O extends Record<string, unknown>>(
  definition: RouteDefinition<S, O>,
) => definition;

const parseAndInvoke = <S extends z.ZodRawShape, O extends Record<string, unknown>>(
  handlerFn: ServiceFn<S, O>,
  requestSchema: z.ZodObject<S>,
  rawInput: unknown,
): O | Promise<O> => handlerFn(requestSchema.parse(rawInput));

const defineHttpRoute = <S extends z.ZodRawShape, O extends Record<string, unknown>>(
  definition: RouteDefinition<S, O>,
): HttpRoute => {
  const { handlerFn, method, path, schema: schemaOverride } = definition;
  const schema = schemaOverride ?? handlerFn.schema;
  const requestSchema = schema.request ?? handlerFn.schema.request;
  const handle = (input: unknown): O | Promise<O> =>
    parseAndInvoke(handlerFn, requestSchema, input);

  return {
    handle,
    method,
    path,
    schema,
  };
};

const successEnvelope = <T>(data: T, sessionId: string) => ({
  code: 200,
  data,
  message: 'Success',
  sessionId,
  success: true,
});

const createProcedure = <S extends z.ZodRawShape, O extends Record<string, unknown>>(
  definition: RouteDefinition<S, O>,
) => {
  const { handlerFn, method, path } = definition;
  const { schema } = handlerFn;
  const wrappedResponseSchema = createWrappedResponseSchema(schema.response);
  const procedure = t.procedure.meta({ method, path, schema });
  return definition.inputOptional === true
    ? procedure.input(schema.request.optional()).output(wrappedResponseSchema)
    : procedure.input(schema.request).output(wrappedResponseSchema);
};

const isTrpcRouteMeta = (value: unknown): value is TrpcRouteMeta =>
  typeof value === 'object' &&
  value !== null &&
  'method' in value &&
  typeof value.method === 'string' &&
  trpcRouteMethods.has(value.method) &&
  'path' in value &&
  typeof value.path === 'string' &&
  value.path.startsWith('/') &&
  'schema' in value &&
  typeof value.schema === 'object' &&
  value.schema !== null &&
  'response' in value.schema &&
  value.schema.response instanceof z.ZodType;

const walkTrpcProcedureTree = (
  tree: TrpcProcedureTree,
  routes: OpenApiRouteDefinition[],
  path: string[] = [],
) => {
  for (const [key, value] of Object.entries(tree)) {
    const currentPath = [...path, key];
    if (typeof value === 'function') {
      const meta: unknown = value.meta;
      if (!isTrpcRouteMeta(meta)) {
        throw new Error(
          `tRPC procedure "${currentPath.join('.')}" is missing route metadata. Build it with createQuery()/createMutation() (via defineTrpcRoute) instead of t.procedure directly.`,
        );
      }
      routes.push({ ...meta, tag: meta.path.slice(1).split('.')[0] });
      continue;
    }
    walkTrpcProcedureTree(value, routes, currentPath);
  }
};

const collectTrpcOpenApiRoutes = (router: TrpcRouterLike): OpenApiRouteDefinition[] => {
  const routes: OpenApiRouteDefinition[] = [];
  walkTrpcProcedureTree(router._def.record, routes);
  return routes;
};

const createQuery = <S extends z.ZodRawShape, O extends Record<string, unknown>>(
  definition: RouteDefinition<S, O>,
) => {
  const { handlerFn } = definition;
  return createProcedure(definition).query(async ({ input, ctx }) => {
    const result = await parseAndInvoke(handlerFn, handlerFn.schema.request, input ?? {});
    return successEnvelope(result, ctx.sessionId ?? getSessionId());
  });
};

const createMutation = <S extends z.ZodRawShape, O extends Record<string, unknown>>(
  definition: RouteDefinition<S, O>,
) => {
  const { handlerFn } = definition;
  return createProcedure(definition).mutation(async ({ input, ctx }) => {
    const result = await parseAndInvoke(handlerFn, handlerFn.schema.request, input);
    return successEnvelope(result, ctx.sessionId ?? getSessionId());
  });
};

const getRouteBase = (
  method: RouteMethod,
  path: string,
  response: z.ZodType,
  tag: string,
  isTrpc = false,
) => {
  const wrappedResponseSchema = createWrappedResponseSchema(response);
  const finalResponseSchema = isTrpc
    ? z.object({
        result: z.object({
          data: wrappedResponseSchema,
        }),
      })
    : wrappedResponseSchema;

  return {
    method,
    path,
    responses: {
      200: {
        content: { 'application/json': { schema: finalResponseSchema } },
        description: 'Success',
      },
    } as const,
    tags: [tag],
  };
};

const buildRequestConfig = (method: RouteMethod, request: z.ZodObject<z.ZodRawShape>) =>
  method === 'get'
    ? { query: request }
    : { body: { content: { 'application/json': { schema: request } } } as const };

const getOpenApiDocument = (
  routes: OpenApiRouteDefinition[],
  serverUrl: string,
): ReturnType<OpenAPIHono['getOpenAPIDocument']> => {
  const router = new OpenAPIHono();
  for (const { method, path, schema, tag } of routes) {
    const base = getRouteBase(method, path, schema.response, tag, true);
    const route = createRoute({ ...base, request: buildRequestConfig(method, schema.request) });
    router.openAPIRegistry.registerPath(route);
  }
  return router.getOpenAPIDocument({
    info: { title: `${requestTypes.trpc} OpenAPI`, version: packageJson.version },
    openapi: openApiVersion,
    servers: [{ url: serverUrl }],
  });
};

const validationErrorHook: Hook<unknown, AppEnv, string, unknown> = (result) => {
  if (!result.success) {
    throw new HTTPException(400, { message: result.error.message });
  }
};

const createHttpRouter = (routesList: HttpRoute[]) => {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationErrorHook });

  for (const { method, path, schema, handle } of routesList) {
    const tag = path.split('/').find((s) => s.length > 0) ?? 'default';
    const base = getRouteBase(method, path, schema.response, tag);

    const route: RouteConfig =
      schema.request === undefined
        ? createRoute(base)
        : createRoute({ ...base, request: buildRequestConfig(method, schema.request) });

    const handler = async (c: Context<AppEnv>) => {
      const result = await handle(method === 'get' ? c.req.query() : await c.req.json());
      return c.json(successEnvelope(result, c.get('sessionId')), 200);
    };

    router.openapi(route, handler);
  }

  return router;
};

const normalizeTrpcGetQuery = (request: Request, query: Record<string, string>): Request => {
  if ('input' in query || Object.keys(query).length === 0) {
    return request;
  }

  const newUrl = new globalThis.URL(request.url);

  for (const key of Object.keys(query)) {
    newUrl.searchParams.delete(key);
  }

  newUrl.searchParams.set('input', JSON.stringify(query));

  return new globalThis.Request(newUrl.toString(), request);
};

const mergeHttpRouters = (routers: Record<string, OpenAPIHono<AppEnv>>) => {
  const app = new OpenAPIHono<AppEnv>();

  for (const router of Object.values(routers)) {
    app.route('/', router);
  }

  return app;
};

const assertHttpRoutesDocumented = (router: OpenAPIHono<AppEnv>) => {
  const registeredKeys = new Set(router.routes.map((route) => `${route.method} ${route.path}`));
  const documentedKeys = new Set(
    router.openAPIRegistry.definitions
      .filter(
        (definition): definition is Extract<OpenApiRegistryDefinition, { type: 'route' }> =>
          definition.type === 'route',
      )
      .map((definition) => `${definition.route.method.toUpperCase()} ${definition.route.path}`),
  );

  const undocumented = [...registeredKeys].filter((key) => !documentedKeys.has(key));
  if (undocumented.length > 0) {
    throw new Error(
      `HTTP route(s) ${undocumented.join(', ')} are registered without OpenAPI documentation. Build them with defineHttpRoute() via createHttpRouter() instead of calling the router's HTTP methods directly.`,
    );
  }
};

export {
  assertHttpRoutesDocumented,
  buildRequestConfig,
  collectTrpcOpenApiRoutes,
  createHttpRouter,
  createMutation,
  createProcedure,
  createQuery,
  createWrappedResponseSchema,
  defineHttpRoute,
  defineTrpcRoute,
  getOpenApiDocument,
  getRouteBase,
  isTrpcRouteMeta,
  mergeHttpRouters,
  normalizeTrpcGetQuery,
  parseAndInvoke,
  successEnvelope,
  t,
  trpcRouteMethods,
  validationErrorHook,
  walkTrpcProcedureTree,
};
export type {
  HttpRoute,
  OpenApiRegistryDefinition,
  OpenApiRouteDefinition,
  RouteDefinition,
  RouteMethod,
  TrpcProcedureTree,
  TrpcRouteMeta,
  TrpcRouterLike,
};
