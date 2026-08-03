import { AsyncLocalStorage } from 'node:async_hooks';
import { getRandomColor } from '../utils/color';

interface RequestContext {
  [key: string]: unknown;
  sessionId: string;
  color?: (text: string) => string;
  metadata?: Record<string, unknown> | object;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

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

export type { RequestContext };
export { getSessionId, getRequestContext, getColor, requestContextStorage };
