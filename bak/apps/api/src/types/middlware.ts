import type { endpoints } from '@lightproject/common/configs';
import type { ChalkInstance } from 'chalk';
import type {
  Locals as ExpressLocals,
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  RequestHandler as ExpressRequestHandler,
  Response as ExpressResponse,
} from 'express';
import type { Primitive } from 'zod';

export interface BaseResponse {
  [key: string]: unknown;
  code?: null | number | undefined;
  data?: null | Record<string, unknown> | Record<string, unknown>[] | undefined;
  error?: Error | null | undefined;
  message?: string;
  sessionId?: SessionId;
  success: boolean;
}

export type Body = null | Record<string, unknown> | string | undefined;

export interface ErrorDetails {
  message: string;
  name: string;
  stack?: string;
  statusCode: number;
}

export type ExpressHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export type Headers = null | Record<string, unknown> | string | undefined;

export type HttpMethod =
  | 'delete'
  | 'get'
  | 'head'
  | 'options'
  | 'patch'
  | 'post'
  | 'put';

export interface InputArgs {
  [key: string]: Primitive | Record<string, unknown> | unknown[];
}

export interface Locals extends ExpressLocals {
  [key: string]: unknown;
  color?: ChalkInstance | undefined;
  error?: ErrorDetails;
  metadata: Metadata;
  sessionId: SessionId;
}

export interface Metadata {
  [key: string]: unknown;
  body?: Body;
  duration?: number | undefined;
  endTime?: number | undefined;
  error?: Error | ErrorDetails | null | undefined;
  headers?: Headers;
  method: string;
  params?: Params;
  query?: Query;
  requestType: endpoints.RequestType;
  startTime: number;
  url: string;
}

export interface MiddlewareLoggingOptionsType {
  logBody?: boolean;
  logHeaders?: boolean;
  logParams?: boolean;
  logQuery?: boolean;
}

export type NextFunction = ExpressNextFunction;

export type OriginalStatusCode = null | number | undefined;

export type Params = null | Record<string, unknown> | string | undefined;

export type Query = null | Record<string, unknown> | string | undefined;

export interface Request extends ExpressRequest {
  locals: Locals;
}

export type RequestHandler = ExpressRequestHandler;

export interface Response extends ExpressResponse {
  locals: Locals & {
    originalStatusCode?: OriginalStatusCode;
    responseBody?: ResponseBody;
  };
}

export type ResponseBody = null | Record<string, unknown> | string | undefined;

export type RouteHandler = (params: {
  ctx: ServiceContext;
  input?: InputArgs;
}) => BaseResponse | Promise<BaseResponse>;

export interface ServiceContext {
  next?: NextFunction | null | undefined;
  req: Request;
  res: Response;
}

export type ServiceMethod = (
  ...args: unknown[]
) => BaseResponse | Promise<BaseResponse>;

export type SessionId = null | string | undefined;

export type {
  Locals as ExpressLocals,
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  RequestHandler as ExpressRequestHandler,
  Response as ExpressResponse,
} from 'express';
