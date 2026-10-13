import { logger, runWithRequestContext } from '@lightproject/common/logger';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { ReportedHttpException, toClientErrorMessage, toClientErrorStack } from '../errors';
import { getLogUrl } from '../log-url';
import type { AppEnv } from '../schema';

type AppContext = Context<AppEnv>;

const getRequestIdFromCtx = (c: AppContext): string => c.get('requestId');

const buildErrorBody = (
  statusCode: ContentfulStatusCode,
  errorCode: string,
  message: string,
  requestId: string,
  stack?: string,
) => ({
  code: statusCode,
  error: {
    code: errorCode,
    message,
    statusCode,
    ...(toClientErrorStack(stack) === undefined ? {} : { stack }),
  },
  message,
  requestId,
  success: false,
});

const notFoundHandler: NotFoundHandler<AppEnv> = (c) => {
  const requestId = getRequestIdFromCtx(c);
  const status = 404;

  runWithRequestContext(c.get('span'), { requestId }, () => {
    const url = getLogUrl(c);
    logger.warn(`Not Found: [${c.req.method}] ${url}`, {
      method: c.req.method,
      path: c.req.path,
      url,
    });
  });

  return c.json(buildErrorBody(status, 'NOT_FOUND', 'Not Found', requestId), status);
};

const respondWithError = (
  c: AppContext,
  err: Error,
  requestId: string,
  status: ContentfulStatusCode,
  errorCode: string,
  logLabel: string,
  message: string,
) => {
  if (!(err instanceof ReportedHttpException)) {
    const span = c.get('span');
    const isServerError = status >= 500;
    if (isServerError) {
      span?.recordException(err);
    }
    runWithRequestContext(span, { requestId }, () => {
      const log = isServerError ? logger.error.bind(logger) : logger.warn.bind(logger);
      const url = getLogUrl(c);
      log(`${logLabel}: ${err.message} [${c.req.method}] ${url}`, {
        err,
        method: c.req.method,
        path: c.req.path,
        status,
        url,
      });
    });
  }

  return c.json(buildErrorBody(status, errorCode, message, requestId, err.stack), status);
};

const globalErrorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = getRequestIdFromCtx(c);

  if (err instanceof HTTPException) {
    return respondWithError(
      c,
      err,
      requestId,
      err.status,
      'HTTP_EXCEPTION',
      'HTTP Exception',
      toClientErrorMessage(err.status, err.message),
    );
  }

  return respondWithError(
    c,
    err,
    requestId,
    500,
    'INTERNAL_SERVER_ERROR',
    'Internal Server Error',
    toClientErrorMessage(500, err.message),
  );
};

export {
  buildErrorBody,
  getRequestIdFromCtx,
  globalErrorHandler,
  notFoundHandler,
  respondWithError,
};
export type { AppContext };
