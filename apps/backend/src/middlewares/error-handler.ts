import { logger, requestContextStorage } from '@lightproject/common/logger';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { config } from '../config';

type AppContext = Context<{ Variables: { sessionId: string } }>;

const getSessionIdFromCtx = (c: AppContext): string => c.get('sessionId');

const buildErrorBody = (
  statusCode: number,
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

const notFoundHandler: NotFoundHandler = (c) => {
  const sessionId = getSessionIdFromCtx(c as AppContext);
  const status = 404;

  logger.warn(`Not Found: [${c.req.method}] ${c.req.url}`, {
    method: c.req.method,
    path: c.req.path,
    url: c.req.url,
  });

  return c.json(buildErrorBody(status, 'NOT_FOUND', 'Not Found', sessionId), status);
};

const globalErrorHandler: ErrorHandler = (err, c) => {
  const sessionId = getSessionIdFromCtx(c as AppContext);

  if (err instanceof HTTPException) {
    const { status } = err;

    requestContextStorage.run({ sessionId }, () => {
      logger.error(`HTTP Exception: ${err.message} [${c.req.method}] ${c.req.url}`, {
        err,
        method: c.req.method,
        path: c.req.path,
        status,
        url: c.req.url,
      });
    });

    return c.json(
      buildErrorBody(status, 'HTTP_EXCEPTION', err.message, sessionId, err.stack),
      status,
    );
  }

  const status = 500;

  requestContextStorage.run({ sessionId }, () => {
    logger.error(`Internal Server Error: ${err.message} [${c.req.method}] ${c.req.url}`, {
      err,
      method: c.req.method,
      path: c.req.path,
      status,
      url: c.req.url,
    });
  });

  return c.json(
    buildErrorBody(
      status,
      'INTERNAL_SERVER_ERROR',
      err.message || 'Internal Server Error',
      sessionId,
      err.stack,
    ),
    status,
  );
};

export { buildErrorBody, getSessionIdFromCtx, globalErrorHandler, notFoundHandler };
export type { AppContext };
