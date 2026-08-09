import type {
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import type { JsonValue } from '@lightproject/common/utils';
import type { RequestType } from '@lightproject/common/configs';

interface ErrorDetails {
  name: string;
  message: string;
  statusCode: number;
  stack?: string;
}

interface Metadata {
  requestType: RequestType;
  method: string;
  source: string;
  startTime: number;
  url: string;
  duration?: number;
  endTime?: number;
  error?: ErrorDetails;
}

interface BaseResponse<T = Record<string, JsonValue> | object> {
  code: number;
  message?: string;
  sessionId: string;
  success: boolean;
  data?: T;
  error?: ErrorDetails;
}

interface Locals {
  error?: ErrorDetails;
  metadata: Metadata;
  sessionId: string;
}

interface Request extends ExpressRequest {
  locals: Locals;
}

interface Response extends ExpressResponse {
  locals: Locals & {
    originalStatusCode?: number;
    responseBody?: Record<string, JsonValue> | object;
  };
}

type NextFunction = ExpressNextFunction;

interface MiddlewareLoggingOptions {
  body: boolean;
  headers: boolean;
  params: boolean;
  query: boolean;
}

interface ServiceContext {
  req: Request;
  res: Response;
}

type InputArgs = Record<string, JsonValue>;

interface TrpcRouteHandlerParams<TInput = never> {
  ctx: ServiceContext;
  input: TInput;
  signal: AbortSignal | undefined;
  path: string;
  batchIndex?: number;
}

type RouteHandlerParams<TInput = never> =
  | (Record<string, JsonValue> & { ctx: ServiceContext; input?: TInput })
  | TrpcRouteHandlerParams<TInput>;

type RouteHandler<T = unknown> = <TInput>(
  params: RouteHandlerParams<TInput>,
) => BaseResponse<T> | Promise<BaseResponse<T>>;

const isRequest = (req: ExpressRequest): req is Request => 'locals' in req;
const isResponse = (res: ExpressResponse): res is Response => 'locals' in res;

export type {
  ServiceContext,
  ErrorDetails,
  Metadata,
  BaseResponse,
  Locals,
  Request,
  Response,
  NextFunction,
  MiddlewareLoggingOptions,
  InputArgs,
  RouteHandler,
  RouteHandlerParams,
};
export { isRequest, isResponse };
