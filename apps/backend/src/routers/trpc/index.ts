import { swaggerUI } from '@hono/swagger-ui';
import {
  docsTrpcEndpoint,
  openApiTrpcJsonEndpoint,
  trpcEndpoint,
} from '@lightproject/common/configs';
import { isLocal } from '@lightproject/common/environment';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { StatusCode } from 'hono/utils/http-status';

import type { AppEnv } from '../../schema';
import { collectTrpcOpenApiRoutes, getOpenApiDocument, normalizeTrpcGetQuery, t } from '../utils';
import { defaultRouter } from './default';
import { testRouter } from './test';

interface TRPCErrorResponse {
  error: {
    message: string;
    data: {
      httpStatus: StatusCode;
      code: string;
      stack?: string;
      path?: string;
    };
  };
}

const isStatusCode = (value: unknown): value is StatusCode =>
  typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599;

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
    isStatusCode(result.error.data?.httpStatus) &&
    typeof result.error.data.code === 'string' &&
    (result.error.data.stack === undefined || typeof result.error.data.stack === 'string') &&
    (result.error.data.path === undefined || typeof result.error.data.path === 'string')
  );
};

const appRouter = t.router({
  default: defaultRouter,
  test: testRouter,
});

const trpcRouter = new Hono<AppEnv>();
const trpcOpenApiRouter = new Hono();

if (isLocal()) {
  const trpcOpenApiRoutes = collectTrpcOpenApiRoutes(appRouter);

  trpcOpenApiRouter.get(openApiTrpcJsonEndpoint, (c) =>
    c.json(getOpenApiDocument(trpcOpenApiRoutes, trpcEndpoint)),
  );
  trpcOpenApiRouter.get(docsTrpcEndpoint, swaggerUI({ url: openApiTrpcJsonEndpoint }));
}

trpcRouter.use('/*', async (c) => {
  const reqToPass =
    c.req.method === 'GET' ? normalizeTrpcGetQuery(c.req.raw, c.req.query()) : c.req.raw;

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

    const error = new HTTPException(result.error.data.httpStatus, {
      cause: {
        code: result.error.data.code,
        path: result.error.data.path,
      },
      message: result.error.message,
    });

    if (result.error.data.stack !== undefined) {
      error.stack = result.error.data.stack;
    }

    throw error;
  }

  return response;
});

type AppRouter = typeof appRouter;

export { appRouter, isStatusCode, isTRPCErrorResponse, trpcOpenApiRouter, trpcRouter };
export type { AppRouter, TRPCErrorResponse };
