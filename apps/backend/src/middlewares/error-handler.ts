import { logger, runWithRequestContext } from '@lightproject/common/logger';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { StatusCode } from 'hono/utils/http-status';

import { config } from '../config';
import type { AppEnv } from '../schema';

type AppContext = Context<AppEnv>;

const getSessionIdFromCtx = (c: AppContext): string => c.get('sessionId');

const buildErrorBody = (
  statusCode: StatusCode,
  errorCode: string,
  message: string,
  sessionId: string,
  stack?: string,
) => ({
  code: statusCode,
  error: {
    code: errorCode,
    message,
    statusCode,
    ...(stack !== undefined && config.enableErrorStack ? { stack } : {}),
  },
  message,
  sessionId,
  success: false,
});

const notFoundHandler: NotFoundHandler<AppEnv> = (c) => {
  const sessionId = getSessionIdFromCtx(c);
  const status = 404;

  runWithRequestContext(c.get('span'), { sessionId }, () => {
    logger.warn(`Not Found: [${c.req.method}] ${c.req.url}`, {
      method: c.req.method,
      path: c.req.path,
      url: c.req.url,
    });
  });

  return c.json(buildErrorBody(status, 'NOT_FOUND', 'Not Found', sessionId), status);
};

const respondWithError = (
  c: AppContext,
  err: Error,
  sessionId: string,
  status: StatusCode,
  errorCode: string,
  logLabel: string,
  message: string,
) => {
  runWithRequestContext(c.get('span'), { sessionId }, () => {
    logger.error(`${logLabel}: ${err.message} [${c.req.method}] ${c.req.url}`, {
      err,
      method: c.req.method,
      path: c.req.path,
      status,
      url: c.req.url,
    });
  });

  return c.json(buildErrorBody(status, errorCode, message, sessionId, err.stack), status);
};

const globalErrorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const sessionId = getSessionIdFromCtx(c);

  if (err instanceof HTTPException) {
    return respondWithError(
      c,
      err,
      sessionId,
      err.status,
      'HTTP_EXCEPTION',
      'HTTP Exception',
      err.message,
    );
  }

  return respondWithError(
    c,
    err,
    sessionId,
    500,
    'INTERNAL_SERVER_ERROR',
    'Internal Server Error',
    err.message || 'Internal Server Error',
  );
};

export {
  buildErrorBody,
  getSessionIdFromCtx,
  globalErrorHandler,
  notFoundHandler,
  respondWithError,
};
export type { AppContext };
