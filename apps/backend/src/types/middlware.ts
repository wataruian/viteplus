import type {
  Locals as ExpressLocals,
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  RequestHandler as ExpressRequestHandler,
  Response as ExpressResponse,
} from 'express';
import type { RequestType } from '@lightproject/common/configs';
import type chalk from 'chalk';

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
  color?: typeof chalk | undefined;
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

type CustomRequest = Omit<ExpressRequest, 'locals'> & {
  locals: Locals;
};

type RequestHandler = ExpressRequestHandler;

type CustomResponse = Omit<ExpressResponse, 'locals'> & {
  locals: Locals & {
    originalStatusCode?: OriginalStatusCode;
    responseBody?: ResponseBody;
  };
};

type ResponseBody = null | Record<string, unknown> | string | undefined;

interface TrpcRouteHandlerParams {
  ctx: ServiceContext;
  input: unknown;
  signal: AbortSignal | undefined;
  path: string;
  batchIndex?: number;
}

type RouteHandlerParams =
  | (Record<string, unknown> & { ctx: ServiceContext; input?: unknown })
  | TrpcRouteHandlerParams;

type RouteHandler = (params: RouteHandlerParams) => BaseResponse | Promise<BaseResponse>;

interface ServiceContext {
  next?: NextFunction | null | undefined;
  req: CustomRequest;
  res: CustomResponse;
}

type ServiceMethod = (...args: unknown[]) => BaseResponse | Promise<BaseResponse>;

type SessionId = null | string | undefined;

const isBaseResponse = (value: unknown): value is BaseResponse =>
  typeof value === 'object' && value !== null && 'success' in value;

const isError = (value: unknown): value is Error => value instanceof Error;

const isLocals = (value: unknown): value is Locals =>
  typeof value === 'object' && value !== null && 'metadata' in value && 'sessionId' in value;

const isHttpMethod = (value: unknown): value is HttpMethod =>
  typeof value === 'string' &&
  ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(value.toLowerCase());

const isCustomRequest = (req: ExpressRequest): req is CustomRequest => isLocals(req.locals);

const isCustomResponse = (res: ExpressResponse): res is CustomResponse => isLocals(res.locals);

const assertIsCustomRequest: (req: unknown) => asserts req is CustomRequest = (_req: unknown) => {};

const assertIsCustomResponse: (res: unknown) => asserts res is CustomResponse = (
  _res: unknown,
) => {};

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
  CustomRequest as Request,
  RequestHandler,
  TrpcRouteHandlerParams,
  RouteHandlerParams,
  CustomResponse as Response,
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

export {
  isBaseResponse,
  isError,
  isLocals,
  isHttpMethod,
  isCustomRequest,
  isCustomResponse,
  assertIsCustomRequest,
  assertIsCustomResponse,
};
