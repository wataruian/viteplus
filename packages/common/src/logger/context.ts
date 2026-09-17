import * as faroSdk from '@grafana/faro-web-sdk';
import {
  type Context,
  type Span,
  type SpanOptions,
  context,
  createContextKey,
  trace,
} from '@opentelemetry/api';

import { isBrowser } from '../environment';
import { getRandomColor } from '../utils/color';
import { runWithSpan, tracer } from '../utils/telemetry';

interface TraceContext {
  spanId: string;
  traceId: string;
}

interface RequestContext {
  [key: string]: unknown;
  sessionId: string;
  color?: (text: string) => string;
  metadata?: Record<string, unknown> | object;
}

const REQUEST_CONTEXT_KEY = createContextKey('request_context');

const isRequestContext = (value: unknown): value is RequestContext =>
  typeof value === 'object' && value !== null && 'sessionId' in value;

const requestContextStorage = {
  getStore: (): RequestContext | undefined => {
    const value = context.active().getValue(REQUEST_CONTEXT_KEY);
    return isRequestContext(value) ? value : undefined;
  },
  run: <R>(store: RequestContext, callback: () => R): R =>
    context.with(context.active().setValue(REQUEST_CONTEXT_KEY, store), callback),
};

let explicitSessionId: string | undefined = undefined;

const setSessionId = (sessionId: string | undefined): void => {
  explicitSessionId = sessionId;

  if (!isBrowser()) {
    return;
  }

  if (sessionId === undefined) {
    faroSdk.faro.api.resetSession();
  } else {
    faroSdk.faro.api.setSession({ id: sessionId });
  }
};

const getSessionId = (): string => {
  if (explicitSessionId !== undefined) {
    return explicitSessionId;
  }
  const store = requestContextStorage.getStore();
  if (store?.sessionId !== undefined) {
    return store.sessionId;
  }
  if (isBrowser()) {
    const faroSessionId = faroSdk.faro.api.getSession()?.id;
    if (faroSessionId !== undefined) {
      return faroSessionId;
    }
  }
  return 'no-id';
};

const getColor = () => {
  const store = requestContextStorage.getStore();
  const color = store?.color;
  if (color) {
    return color;
  }
  return getRandomColor(getSessionId());
};

const getRequestContext = (): RequestContext | undefined => requestContextStorage.getStore();

const getTraceContext = (): TraceContext | undefined => {
  const spanContext = trace.getSpanContext(context.active());
  if (spanContext === undefined || !trace.isSpanContextValid(spanContext)) {
    return undefined;
  }
  return { spanId: spanContext.spanId, traceId: spanContext.traceId };
};

const runWithRequestContext = <R>(span: Span, store: RequestContext, fn: () => R): R =>
  runWithSpan(span, () => requestContextStorage.run(store, fn));

const startSpanWithSession = (name: string, options: SpanOptions = {}, ctx?: Context): Span => {
  const sessionId = getSessionId();

  return tracer.startSpan(
    name,
    {
      ...options,
      attributes: {
        ...(sessionId === 'no-id' ? {} : { 'session.id': sessionId }),
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
  getSessionId,
  getTraceContext,
  isRequestContext,
  requestContextStorage,
  runWithRequestContext,
  setSessionId,
  startSpanWithSession,
};
export type { RequestContext, TraceContext };
