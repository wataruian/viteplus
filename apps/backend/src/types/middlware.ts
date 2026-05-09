import type {
  Locals as ExpressLocals,
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  RequestHandler as ExpressRequestHandler,
  Response as ExpressResponse,
} from 'express';
import type { ChalkInstance } from 'chalk';
import type { RequestType } from '@lightproject/common/configs';

type Primitive = string | number | boolean | bigint | symbol | undefined | null;

interface BaseResponse {
  [key: string]: unknown;
  code?: null | number | undefined;
  data?: null | Record<string, unknown> | Record<string, unknown>[] | undefined;
  error?: Error | null | undefined;
  message?: string;
  sessionId?: SessionId;
  success: boolean;
}

type Body = null | Record<string, unknown> | string | undefined;

interface ErrorDetails {
  message: string;
  name: string;
  stack?: string;
  statusCode: number;
}

type ExpressHandler = (req: Request, res: Response, next: NextFunction) => void;

type Headers = null | Record<string, unknown> | string | undefined;

type HttpMethod = 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put';

type InputArgs = Record<string, Primitive | Record<string, unknown> | unknown[]>;

interface Locals extends ExpressLocals {
  [key: string]: unknown;
  color?: ChalkInstance | undefined;
  error?: ErrorDetails;
  metadata: Metadata;
  sessionId: SessionId;
}

interface Metadata {
  [key: string]: unknown;
  body?: Body;
  duration?: number | undefined;
  endTime?: number | undefined;
  error?: Error | ErrorDetails | null | undefined;
  headers?: Headers;
  method: string;
  params?: Params;
  query?: Query;
  requestType: RequestType;
  startTime: number;
  url: string;
}

interface MiddlewareLoggingOptionsType {
  logBody?: boolean;
  logHeaders?: boolean;
  logParams?: boolean;
  logQuery?: boolean;
}

type NextFunction = ExpressNextFunction;

type OriginalStatusCode = null | number | undefined;

type Params = null | Record<string, unknown> | string | undefined;

type Query = null | Record<string, unknown> | string | undefined;

interface Request extends ExpressRequest {
  locals: Locals;
}

type RequestHandler = ExpressRequestHandler;

interface Response extends ExpressResponse {
  locals: Locals & {
    originalStatusCode?: OriginalStatusCode;
    responseBody?: ResponseBody;
  };
}

type ResponseBody = null | Record<string, unknown> | string | undefined;

type RouteHandler = (params: {
  ctx: ServiceContext;
  input?: InputArgs;
}) => BaseResponse | Promise<BaseResponse>;

interface ServiceContext {
  next?: NextFunction | null | undefined;
  req: Request;
  res: Response;
}

type ServiceMethod = (...args: unknown[]) => BaseResponse | Promise<BaseResponse>;

type SessionId = null | string | undefined;

export type {
  Primitive,
  BaseResponse,
  Body,
  ErrorDetails,
  ExpressHandler,
  Headers,
  HttpMethod,
  InputArgs,
  Locals,
  Metadata,
  MiddlewareLoggingOptionsType,
  NextFunction,
  OriginalStatusCode,
  Params,
  Query,
  Request,
  RequestHandler,
  Response,
  ResponseBody,
  RouteHandler,
  ServiceContext,
  ServiceMethod,
  SessionId,
};

export type {
  Locals as ExpressLocals,
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  RequestHandler as ExpressRequestHandler,
  Response as ExpressResponse,
} from 'express';
