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
import { isRecord } from '../validators/validate';

interface TraceContext {
  spanId: string;
  traceId: string;
}

interface RequestContext {
  [key: string]: unknown;
  requestId?: string;
  color?: (text: string) => string;
  metadata?: Record<string, unknown> | object;
}

const REQUEST_CONTEXT_KEY = createContextKey('request_context');

const isRequestContext = (value: unknown): value is RequestContext =>
  isRecord(value) &&
  (value['requestId'] === undefined || typeof value['requestId'] === 'string') &&
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

const getRequestId = (): string =>
  requestContextStorage.getStore()?.requestId ?? explicitRequestId ?? 'no-id';

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

  return tracer.startSpan(
    name,
    {
      ...options,
      attributes: {
        ...(requestId === 'no-id' ? {} : { 'request.id': requestId }),
        ...options.attributes,
      },
    },
    ctx,
  );
};

export {
  REQUEST_CONTEXT_KEY,
  getColor,
  getRequestContext,
  getRequestId,
  getTraceContext,
  isRequestContext,
  requestContextStorage,
  runWithRequestContext,
  setRequestId,
  startSpanWithRequestId,
};
export type { RequestContext, TraceContext };
