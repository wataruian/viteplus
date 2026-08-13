import { type RequestType, getRequestType } from '@lightproject/common/configs';
import { type RequestContext, logger, requestContextStorage } from '@lightproject/common/logger';
import {
  type Counter,
  type JsonValue,
  context,
  generateUuid,
  getMeter,
  getNextRandomColor,
  trace,
  tracer,
} from '@lightproject/common/utils';
import type express from 'express';
import type {
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import type { z } from 'zod';

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

interface ParsedType {
  base?: string;
  itemType?: ParsedType | string;
  kind: 'array' | 'object' | 'primitive' | 'union';
  properties?: Record<string, ParsedType | string>;
  types?: (ParsedType | string)[];
  required?: boolean;
}

interface ParameterMetadata {
  name: string;
  defaultValue?: boolean | number | string | undefined | unknown[] | Record<string, unknown>;
  description?: string | undefined;
  properties?: ParameterMetadata[] | undefined;
  required?: boolean | undefined;
  type: string | ParsedType | Record<string, unknown>;
}

interface RouteHandlerInfo {
  handlerFilePath: string;
  path: string;
  procedureType?: 'mutation' | 'query' | undefined;
  serviceClass: string | undefined;
  serviceMethod: string | undefined;
}

interface RouteInfo {
  handlerFilePath?: string | undefined;
  input?: ParameterMetadata[] | undefined;
  method?: string | undefined;
  output?: ParameterMetadata | undefined;
  path: string;
  requestType: string;
  serviceClass?: string | undefined;
  serviceFilePath?: string | undefined;
  serviceMethod?: string | undefined;
  type?: string | undefined;
}

interface ServiceMetadata {
  input: ParameterMetadata[] | undefined;
  output: ParameterMetadata | undefined;
  serviceFilePath: string | undefined;
}

type InferSchemaMap<T extends Record<string, z.ZodType>> = { [K in keyof T]: z.infer<T[K]> };

const isRequest = (req: ExpressRequest): req is Request => 'locals' in req;
const isResponse = (res: ExpressResponse): res is Response => 'locals' in res;

let lastColor: ((text: string) => string) | undefined = undefined;
let requestHitsCounter: Counter | undefined = undefined;

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
      root: true,
    });

    try {
      requestHitsCounter ??= getMeter().createCounter('request_hits', {
        description: 'request_hits',
      });
      requestHitsCounter.add(1);
      logger.info('Pushed request_hits metric');
    } catch {
      // Skip metric counter if it fails
    }

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

export { initializeRequest, isRequest, isResponse };
export type {
  BaseResponse,
  ErrorDetails,
  InferSchemaMap,
  InputArgs,
  Locals,
  Metadata,
  MiddlewareLoggingOptions,
  NextFunction,
  ParameterMetadata,
  ParsedType,
  Request,
  Response,
  RouteHandler,
  RouteHandlerInfo,
  RouteHandlerParams,
  RouteInfo,
  ServiceContext,
  ServiceMetadata,
};
