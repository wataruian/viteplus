import type {
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import {
  type JsonValue,
  context,
  generateUuid,
  getNextRandomColor,
  trace,
  tracer,
} from '@lightproject/common/utils';
import { type RequestContext, logger, requestContextStorage } from '@lightproject/common/logger';
import { type RequestType, getRequestType } from '@lightproject/common/configs';
import type express from 'express';

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

let lastColor: ((text: string) => string) | undefined = undefined;

const initializeRequest = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  try {
    const sessionId = generateUuid();

    const initialLocals: Locals = {
      metadata: {
        method: req.method,
        requestType: getRequestType(req.originalUrl),
        source: 'initializeRequest',
        startTime: Date.now(),
        url: req.originalUrl,
      },
      sessionId,
    };

    Reflect.set(req, 'locals', initialLocals);
    Reflect.set(res, 'locals', initialLocals);

    const span = tracer.startSpan(`http.request:${req.method}`, {
      attributes: {
        'http.method': req.method,
        'http.path': req.path,
        'http.url': req.originalUrl,
        'session.id': sessionId,
      },
    });

    res.on('finish', () => {
      span.setAttribute('http.status_code', res.statusCode);
      span.end();
    });

    res.on('close', () => {
      if (span.isRecording()) {
        span.end();
      }
    });

    const { nextColor } = getNextRandomColor(sessionId, lastColor);
    lastColor = nextColor;

    context.with(trace.setSpan(context.active(), span), () => {
      const contextStore: RequestContext = {
        ...initialLocals,
        color: nextColor,
        sessionId,
      };
      requestContextStorage.run(contextStore, () => {
        logger.info(`Initializing [${req.method}] request session`, initialLocals);
        next();
      });
    });
  } catch (error) {
    next(error);
  }
};

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
export { isRequest, isResponse, initializeRequest };
