import { swaggerUI } from '@hono/swagger-ui';
import {
  docsTrpcEndpoint,
  openApiTrpcJsonEndpoint,
  trpcEndpoint,
} from '@lightproject/common/configs';
import { isLocal } from '@lightproject/common/environment';
import { logger, runWithRequestContext } from '@lightproject/common/logger';
import type { AnyTRPCRouter, TRPCError } from '@trpc/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { type Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ClientErrorStatusCode, ServerErrorStatusCode } from 'hono/utils/http-status';

import { ReportedHttpException } from '../../errors';
import { getLogUrl } from '../../log-url';
import { getRequestStore } from '../../request-context';
import type { AppEnv } from '../../schema';
import { collectTrpcOpenApiRoutes, getOpenApiDocument, normalizeTrpcGetQuery, t } from '../utils';
import { defaultRouter } from './default';
import { testRouter } from './test';

type ErrorStatusCode = ClientErrorStatusCode | ServerErrorStatusCode;

interface TRPCErrorResponse {
  error: {
    message: string;
    data: {
      httpStatus: ErrorStatusCode;
      code: string;
      stack?: string;
      path?: string;
    };
  };
}

const isErrorStatusCode = (value: unknown): value is ErrorStatusCode =>
  typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599;

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
    isErrorStatusCode(result.error.data?.httpStatus) &&
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

const logTrpcServerError = (c: Context<AppEnv>, error: TRPCError, path: string | undefined) => {
  if (getHTTPStatusCodeFromError(error) < 500) {
    return;
  }
  const cause = error.cause ?? error;
  const span = c.get('span');
  span?.recordException(cause);
  runWithRequestContext(span, getRequestStore(c), () => {
    logger.error(`tRPC Internal Server Error: ${error.message} [${c.req.method}] ${getLogUrl(c)}`, {
      err: cause,
      path,
    });
  });
};

const handleTrpcRequest = async (c: Context<AppEnv>, router: AnyTRPCRouter): Promise<Response> => {
  const reqToPass =
    c.req.method === 'GET' ? normalizeTrpcGetQuery(c.req.raw, c.req.query()) : c.req.raw;

  const response = await fetchRequestHandler({
    createContext: () => ({
      requestId: c.get('requestId'),
    }),
    endpoint: trpcEndpoint,
    onError: ({ error, path }) => {
      logTrpcServerError(c, error, path);
    },
    req: reqToPass,
    router,
  });

  if (!response.ok) {
    const result: unknown = await response.clone().json();

    if (!isTRPCErrorResponse(result)) {
      return response;
    }

    const status = result.error.data.httpStatus;
    const options = {
      cause: { code: result.error.data.code, path: result.error.data.path },
      message: result.error.message,
    };
    const error =
      status >= 500
        ? new ReportedHttpException(status, options)
        : new HTTPException(status, options);

    if (result.error.data.stack !== undefined) {
      error.stack = result.error.data.stack;
    }

    throw error;
  }

  return response;
};

trpcRouter.all('/*', async (c) => await handleTrpcRequest(c, appRouter));

type AppRouter = typeof appRouter;

export {
  appRouter,
  handleTrpcRequest,
  isErrorStatusCode,
  isTRPCErrorResponse,
  logTrpcServerError,
  trpcOpenApiRouter,
  trpcRouter,
};
export type { AppRouter, ErrorStatusCode, TRPCErrorResponse };
