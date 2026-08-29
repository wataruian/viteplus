import { swaggerUI } from '@hono/swagger-ui';
import {
  docsTrpcEndpoint,
  openApiTrpcJsonEndpoint,
  trpcEndpoint,
} from '@lightproject/common/configs';
import { isLocal } from '@lightproject/common/environment';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { Hono } from 'hono';

import { collectTrpcOpenApiRoutes, getOpenApiDocument, t } from '../utils';
import { defaultRouter } from './default';
import { testRouter } from './test';

interface TRPCErrorResponse {
  error: {
    message: string;
    data: {
      httpStatus: number;
      code: string;
      stack?: string;
      path?: string;
    };
  };
}

const isTRPCErrorResponse = (value: unknown): value is TRPCErrorResponse => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as {
    error?: {
      message?: unknown;
      data?: {
        httpStatus?: unknown;
        code?: unknown;
        stack?: unknown;
        path?: unknown;
      };
    };
  };

  return (
    typeof result.error?.message === 'string' &&
    typeof result.error.data?.httpStatus === 'number' &&
    typeof result.error.data.code === 'string' &&
    (result.error.data.stack === undefined || typeof result.error.data.stack === 'string') &&
    (result.error.data.path === undefined || typeof result.error.data.path === 'string')
  );
};

const appRouter = t.router({
  default: defaultRouter,
  test: testRouter,
});

const trpcRouter = new Hono<{ Variables: { sessionId: string } }>();
const trpcOpenApiRouter = new Hono();

if (isLocal()) {
  const trpcOpenApiRoutes = collectTrpcOpenApiRoutes(appRouter);

  trpcOpenApiRouter.get(openApiTrpcJsonEndpoint, (c) =>
    c.json(getOpenApiDocument(trpcOpenApiRoutes, trpcEndpoint)),
  );
  trpcOpenApiRouter.get(docsTrpcEndpoint, swaggerUI({ url: openApiTrpcJsonEndpoint }));
}

trpcRouter.use('/*', async (c) => {
  let reqToPass = c.req.raw;
  if (c.req.method === 'GET') {
    const query = c.req.query();
    if (!('input' in query) && Object.keys(query).length > 0) {
      const { Request, URL } = globalThis;
      const newUrl = new URL(c.req.url);
      for (const key of Object.keys(query)) {
        newUrl.searchParams.delete(key);
      }
      newUrl.searchParams.set('input', JSON.stringify(query));
      reqToPass = new Request(newUrl.toString(), c.req.raw);
    }
  }

  const response = await fetchRequestHandler({
    createContext: () => ({
      sessionId: c.get('sessionId'),
    }),
    endpoint: trpcEndpoint,
    req: reqToPass,
    router: appRouter,
  });

  if (!response.ok) {
    const result: unknown = await response.clone().json();

    if (!isTRPCErrorResponse(result)) {
      return response;
    }

    const error = new Error(result.error.message, {
      cause: {
        code: result.error.data.code,
        path: result.error.data.path,
        statusCode: result.error.data.httpStatus,
      },
    });

    if (result.error.data.stack !== undefined) {
      error.stack = result.error.data.stack;
    }

    throw error;
  }

  return response;
});

type AppRouter = typeof appRouter;
type TrpcRouter = AppRouter;

export { appRouter, isTRPCErrorResponse, trpcOpenApiRouter, trpcRouter };
export type { AppRouter, TRPCErrorResponse, TrpcRouter };
