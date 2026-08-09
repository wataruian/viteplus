import type {
  BaseResponse,
  ErrorDetails,
  MiddlewareLoggingOptions,
  NextFunction,
  Request,
  Response,
} from '../types/middlware';
import { type JsonValue, safeSerialize } from '@lightproject/common/utils';
import { getEnv, isProduction, isTrue } from '@lightproject/common/environment';
import { Buffer } from 'node:buffer';
import type { TRPCError } from '@trpc/server';
import { captureResponse } from './capture-response';
import { isTrpcEndpoint } from '@lightproject/common/configs';
import { logger } from '@lightproject/common/logger';

const loggingOptions: MiddlewareLoggingOptions = {
  body: false,
  headers: false,
  params: false,
  query: false,
};

const isErrorStackEnabled = isTrue(getEnv('ENABLE_ERROR_STACK')) || !isProduction();

const getStatusCode = (statusCode?: number): number => {
  if (statusCode === undefined || statusCode === 0) {
    return 500;
  }
  return statusCode === 200 ? 500 : statusCode;
};

const getErrorDetails = (err: Error | ErrorDetails | TRPCError, res: Response) => {
  const error: ErrorDetails = {
    message: err.message === '' ? 'Unknown error occurred' : err.message,
    name: err.name === '' ? 'UnknownError' : err.name,
    stack: err.stack ?? 'No stack trace available',
    statusCode: getStatusCode(res.statusCode),
  };
  return error;
};

const getErrorResponse = (error: ErrorDetails, req: Request, res: Response): BaseResponse => ({
  code: res.statusCode,
  error,
  message: error.message,
  sessionId: req.locals.sessionId,
  success: false,
});

const getDuration = (startTime: number, endTime?: number): number =>
  (endTime ?? Date.now()) - startTime;

const getLogMetadata = (req: Request) => {
  const metadata: Record<string, JsonValue> = {};

  for (const key of ['body', 'headers', 'params', 'query'] as const) {
    if (loggingOptions[key]) {
      metadata[key] = safeSerialize(req[key]);
    }
  }

  return {
    ...req.locals.metadata,
    ...metadata,
  };
};

const gatewayMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (isTrpcEndpoint(req.originalUrl) && Buffer.isBuffer(req.body)) {
      req.body = req.body.toString();
    }

    captureResponse(res);

    logger.info(
      `Incoming [${req.method}] request`,
      safeSerialize({
        ...req.locals,
        metadata: {
          ...getLogMetadata(req),
          source: 'requestHandler',
        },
      }),
    );

    res.on('finish', () => {
      if (req.locals.error || res.statusCode >= 400) {
        return;
      }

      const startTime = req.locals.metadata.startTime || Date.now();
      const endTime = Date.now();

      logger.info(
        `Response completed for [${req.method}] request with status: ${res.statusCode}`,
        safeSerialize({
          ...req.locals,
          ...res.locals,
          metadata: {
            ...getLogMetadata(req),
            duration: getDuration(startTime, endTime),
            endTime,
            headers: loggingOptions.headers ? res.getHeaders() : undefined,
            responseBody: res.locals.responseBody ?? undefined,
            source: 'responseHandler',
            statusCode: res.statusCode,
          },
        }),
      );
    });

    next();
  } catch (error) {
    next(error);
  }
};

const processError = ({
  err,
  message,
  req,
  res,
  throwError = false,
}: {
  err: Error | ErrorDetails | TRPCError;
  message?: string;
  req: Request;
  res: Response;
  throwError?: boolean;
}) => {
  const startTime = req.locals.metadata.startTime || Date.now();
  const errorDetails = getErrorDetails(err, res);
  const errorMessage = message ?? errorDetails.message;
  const statusCode = getStatusCode(res.statusCode);
  res.statusCode = statusCode;
  req.locals.error = errorDetails;
  const endTime = Date.now();

  logger.error(
    `Error [${req.method}]: ${errorMessage}`,
    safeSerialize({
      ...req.locals,
      ...res.locals,
      error: errorDetails,
      metadata: {
        ...getLogMetadata(req),
        duration: getDuration(startTime, endTime),
        endTime,
        headers: loggingOptions.headers ? res.getHeaders() : undefined,
        source: 'errorHandler',
        statusCode,
      },
    }),
  );

  if (!isErrorStackEnabled) {
    delete errorDetails.stack;
  }

  if (throwError) {
    throw err instanceof Error ? err : new Error(JSON.stringify(err));
  }

  return errorDetails;
};

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): BaseResponse => {
  const errorDetails = processError({
    err,
    message: `Error Response [${req.method}]`,
    req,
    res,
  });

  const errorResponse = getErrorResponse(errorDetails, req, res);

  if (!res.headersSent) {
    res.status(getStatusCode(res.statusCode)).json(errorResponse);
  }

  return errorResponse;
};

export {
  getErrorResponse,
  gatewayMiddleware,
  loggingOptions,
  getLogMetadata,
  isErrorStackEnabled,
  getStatusCode,
  getDuration,
  getErrorDetails,
  processError,
  errorHandler,
};
