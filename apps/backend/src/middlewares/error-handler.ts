import type {
  BaseResponse,
  ErrorDetails,
  NextFunction,
  Request,
  Response,
} from '../types/middlware';
import { loggingOptions, syncLocals } from './gateway-middleware';
import type { TRPCError } from '@trpc/server';
import { isProduction } from '@lightproject/common/environment';
import { isRecord } from '@lightproject/common/validators';
import { logger } from '@lightproject/common/logger';
import { safeSerialize } from '@lightproject/common/utils';

const enableErrorStack =
  globalThis.process.env['ENABLE_ERROR_STACK'] === 'true' ? true : !isProduction();

const isErrorDetails = (value: unknown): value is ErrorDetails =>
  typeof value === 'object' &&
  value !== null &&
  'message' in value &&
  'name' in value &&
  'statusCode' in value;

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

const getErrorMessage = (error: unknown): string => {
  const errorMessage =
    error !== null && typeof error === 'object' && 'message' in error
      ? String(Reflect.get(error, 'message'))
      : String(error);

  return errorMessage === '' ? 'Unknown error occurred' : errorMessage;
};

const handleError = ({
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

  let errorMessage = message;

  if (errorMessage === undefined || errorMessage === '') {
    errorMessage = getErrorMessage(err);
  }

  const statusCode = getStatusCode(res.statusCode);
  res.statusCode = statusCode;

  const error = getErrorDetails(err, res);

  const endTime = Date.now();
  const duration = endTime - startTime;

  const metadata = {
    ...req.locals.metadata,
    body: loggingOptions.logBody === true ? safeSerialize(req.body) : undefined,
    duration,
    endTime,
    error: (() => {
      const s = safeSerialize(error);
      return isErrorDetails(s) ? s : error;
    })(),
    headers: loggingOptions.logHeaders === true ? safeSerialize(res.getHeaders()) : undefined,
    params: loggingOptions.logParams === true ? safeSerialize(req.params) : undefined,
    query: loggingOptions.logQuery === true ? safeSerialize(req.query) : undefined,
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

  const serializedLocalsRaw = safeSerialize({
    ...req.locals,
    ...res.locals,
  });

  const serializedLocals = isRecord(serializedLocalsRaw) ? serializedLocalsRaw : {};

  logger.error(`Error [${req.method}]: ${errorMessage}`, serializedLocals);

  if (!enableErrorStack) {
    delete error.stack;
  }

  if (throwError) {
    throw err instanceof Error ? err : new Error(JSON.stringify(err));
  }

  return error;
};

const getErrorResponse = (error: ErrorDetails, req: Request, res: Response): BaseResponse => {
  const serializedErrorRaw = safeSerialize(error);
  const serializedError = isErrorDetails(serializedErrorRaw) ? serializedErrorRaw : error;

  const errorResponse: BaseResponse = {
    code: res.statusCode,
    error: serializedError,
    message: serializedError.message === '' ? 'Error' : serializedError.message,
    sessionId: req.locals.sessionId ?? undefined,
    success: false,
  };

  return errorResponse;
};

const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): BaseResponse => {
  const errorDetails = handleError({
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
  enableErrorStack,
  getStatusCode,
  getErrorDetails,
  getErrorMessage,
  handleError,
  getErrorResponse,
  isErrorDetails,
  errorHandler,
};
