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

interface TrpcRouteHandlerParams {
  ctx: ServiceContext;
  input: JsonValue;
  signal: AbortSignal | undefined;
  path: string;
  batchIndex?: number;
}

type RouteHandlerParams =
  | (Record<string, JsonValue> & { ctx: ServiceContext; input?: JsonValue })
  | TrpcRouteHandlerParams;

type RouteHandler<T = unknown> = (
  params: RouteHandlerParams,
) => BaseResponse<T> | Promise<BaseResponse<T>>;

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
