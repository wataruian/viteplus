import { environment, utils } from '@lightproject/common';
import { logger } from '@lightproject/common/logger';
import type { TRPCError } from '@trpc/server';

import type {
  BaseResponse,
  ErrorDetails,
  NextFunction,
  Request,
  Response,
} from '../types/middlware';

import { loggingOptions, syncLocals } from './gateway-middleware';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

export const enableErrorStack =
  process.env['ENABLE_ERROR_STACK'] === 'true'
    ? true
    : !environment.isProduction();

export const getErrorDetails = (
  err: Error | ErrorDetails | TRPCError,
  res: Response
) => {
  const error: ErrorDetails = {
    message: err.message || 'Unknown error occurred',
    name: err.name || 'UnknownError',
    stack: err.stack || 'No stack trace available',
    statusCode: getStatusCode(res?.statusCode),
  };

  return error;
};

export const getErrorMessage = (
  error: Error | ErrorDetails | TRPCError | unknown
): string => {
  const errorMessage =
    error && typeof error === 'object' && 'message' in error
      ? (error as { message: string }).message
      : String(error);

  return errorMessage || 'Unknown error occurred';
};

export const handleError = ({
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
  if (!req.locals) {
    req.locals = {} as Request['locals'];
  }

  if (!req.locals.metadata) {
    req.locals.metadata = {} as Request['locals']['metadata'];
  }

  const startTime = req.locals.metadata.startTime || Date.now();

  if (!req.locals.metadata.startTime) {
    req.locals.metadata.startTime = startTime;
  }

  let errorMessage = message;

  if (!errorMessage) {
    errorMessage = getErrorMessage(err);
  }

  const statusCode = getStatusCode(res?.statusCode);
  res.statusCode = statusCode;

  const error = getErrorDetails(err, res);

  const endTime = Date.now();
  const duration = endTime - startTime;

  const metadata = {
    ...req.locals.metadata,
    body: loggingOptions.logBody
      ? utils.serialize.safeSerialize(req.body)
      : undefined,
    duration,
    endTime,
    error: utils.serialize.safeSerialize(error) as ErrorDetails,
    headers: loggingOptions.logHeaders
      ? utils.serialize.safeSerialize(res.getHeaders())
      : undefined,
    params: loggingOptions.logParams
      ? utils.serialize.safeSerialize(req.params)
      : undefined,
    query: loggingOptions.logQuery
      ? utils.serialize.safeSerialize(req.query)
      : undefined,
    source: 'errorHandler',
    statusCode,
  };

  syncLocals({
    locals: {
      ...metadata,
    },
    req,
    res,
    target: 'both',
  });

  const serializedLocals = utils.serialize.safeSerialize({
    ...req.locals,
    ...res.locals,
  });

  logger.error(`Error [${req.method}]: ${errorMessage}`, serializedLocals);

  if (!enableErrorStack) {
    // biome-ignore lint/performance/noDelete: ignore
    delete error.stack;
  }

  if (throwError) {
    throw err;
  }

  return error;
};

export const getErrorResponse = (
  error: ErrorDetails,
  req: Request,
  res: Response
): BaseResponse => {
  const serializedError = utils.serialize.safeSerialize(error) as ErrorDetails;

  const errorResponse: BaseResponse = {
    code: res.statusCode,
    error: serializedError,
    message: serializedError.message || 'Error',
    sessionId: req.locals.sessionId || undefined,
    success: false,
  };

  return errorResponse;
};

export const isErrorDetails = (value: unknown): value is ErrorDetails =>
  typeof value === 'object' &&
  value !== null &&
  'message' in value &&
  'name' in value &&
  'statusCode' in value;

export const getStatusCode = (statusCode?: number): number => {
  if (!statusCode) {
    return HTTP_STATUS_INTERNAL_SERVER_ERROR;
  }

  return statusCode === HTTP_STATUS_OK
    ? HTTP_STATUS_INTERNAL_SERVER_ERROR
    : statusCode;
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): BaseResponse => {
  const errorDetails = handleError({
    err,
    message: `Error Response [${req.method}]`,
    req,
    res,
  });

  const errorResponse = getErrorResponse(errorDetails, req, res);

  if (!res.headersSent) {
    res.status(getStatusCode(res?.statusCode)).json(errorResponse);
  }

  return errorResponse;
};
