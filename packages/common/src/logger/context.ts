import {
  type Context,
  type Span,
  type SpanOptions,
  context,
  createContextKey,
  trace,
} from '@opentelemetry/api';

import { getRandomColor } from '../utils/color';
import { runWithSpan, tracer } from '../utils/telemetry';
import { generateShortUuid } from '../utils/text';
import { isRecord } from '../validators/validate';

interface TraceContext {
  spanId: string;
  traceId: string;
}

interface RequestContext {
  [key: string]: unknown;
  requestId?: string;
  clientId?: string;
  color?: (text: string) => string;
  metadata?: Record<string, unknown> | object;
}

interface RequestScope {
  requestId: string;
  span: Span;
  run: <R>(fn: () => R) => R;
}

const REQUEST_CONTEXT_KEY = createContextKey('request_context');

const isRequestContext = (value: unknown): value is RequestContext =>
  isRecord(value) &&
  (value['requestId'] === undefined || typeof value['requestId'] === 'string') &&
  (value['clientId'] === undefined || typeof value['clientId'] === 'string') &&
  (value['color'] === undefined || typeof value['color'] === 'function');

const requestContextStorage = {
  getStore: (): RequestContext | undefined => {
    const value = context.active().getValue(REQUEST_CONTEXT_KEY);
    return isRequestContext(value) ? value : undefined;
  },
  run: <R>(store: RequestContext, callback: () => R): R =>
    context.with(context.active().setValue(REQUEST_CONTEXT_KEY, store), callback),
};

let explicitRequestId: string | undefined = undefined;

const setRequestId = (requestId: string | undefined): void => {
  explicitRequestId = requestId;
};

let explicitClientId: string | undefined = undefined;

const setClientId = (clientId: string | undefined): void => {
  explicitClientId = clientId;
};

const getRequestIdsFor = (ctx: Context): { clientId?: string; requestId?: string } => {
  const value = ctx.getValue(REQUEST_CONTEXT_KEY);
  const store = isRequestContext(value) ? value : undefined;
  const requestId = store?.requestId ?? explicitRequestId;
  const clientId = store?.clientId ?? explicitClientId;
  return {
    ...(requestId === undefined ? {} : { requestId }),
    ...(clientId === undefined ? {} : { clientId }),
  };
};

const getRequestId = (): string => getRequestIdsFor(context.active()).requestId ?? 'no-id';

const getClientId = (): string | undefined => getRequestIdsFor(context.active()).clientId;

const getColor = () => {
  const store = requestContextStorage.getStore();
  const color = store?.color;
  if (color) {
    return color;
  }
  return getRandomColor(getRequestId());
};

const getRequestContext = (): RequestContext | undefined => requestContextStorage.getStore();

const getTraceContext = (): TraceContext | undefined => {
  const spanContext = trace.getSpanContext(context.active());
  if (spanContext === undefined || !trace.isSpanContextValid(spanContext)) {
    return undefined;
  }
  return { spanId: spanContext.spanId, traceId: spanContext.traceId };
};

const runWithRequestContext = <R>(span: Span | undefined, store: RequestContext, fn: () => R): R =>
  span === undefined
    ? requestContextStorage.run(store, fn)
    : runWithSpan(span, () => requestContextStorage.run(store, fn));

const startSpanWithRequestId = (name: string, options: SpanOptions = {}, ctx?: Context): Span => {
  const requestId = getRequestId();
  const clientId = getClientId();

  return tracer.startSpan(
    name,
    {
      ...options,
      attributes: {
        ...(requestId === 'no-id' ? {} : { 'request.id': requestId }),
        ...(clientId === undefined ? {} : { 'client.id': clientId }),
        ...options.attributes,
      },
    },
    ctx,
  );
};

const startRequestScope = (
  name: string,
  options: SpanOptions = {},
  ctx?: Context,
): RequestScope => {
  const requestId = generateShortUuid();
  const span = startSpanWithRequestId(
    name,
    { ...options, attributes: { 'request.id': requestId, ...options.attributes } },
    ctx,
  );
  return {
    requestId,
    run: (fn) => runWithRequestContext(span, { requestId }, fn),
    span,
  };
};

export {
  REQUEST_CONTEXT_KEY,
  getClientId,
  getColor,
  getRequestContext,
  getRequestId,
  getRequestIdsFor,
  getTraceContext,
  isRequestContext,
  requestContextStorage,
  runWithRequestContext,
  setClientId,
  setRequestId,
  startRequestScope,
  startSpanWithRequestId,
};
export type { RequestContext, RequestScope, TraceContext };
