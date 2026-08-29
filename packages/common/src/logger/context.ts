import { context, createContextKey } from '@opentelemetry/api';

import { getRandomColor } from '../utils/color';

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

const getSessionId = (): string => {
  const store = requestContextStorage.getStore();
  return store?.sessionId ?? 'no-id';
};

const getColor = () => {
  const store = requestContextStorage.getStore();
  const color = store?.color;
  if (color) {
    return color;
  }
  return getRandomColor(store?.sessionId ?? 'no-id');
};

const getRequestContext = (): RequestContext | undefined => requestContextStorage.getStore();

export {
  getColor,
  getRequestContext,
  getSessionId,
  isRequestContext,
  REQUEST_CONTEXT_KEY,
  requestContextStorage,
};
export type { RequestContext };
