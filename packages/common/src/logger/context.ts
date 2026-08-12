import { AsyncLocalStorage } from 'node:async_hooks';

import { getRandomColor } from '../utils/color';

interface RequestContext {
  [key: string]: unknown;
  sessionId: string;
  color?: (text: string) => string;
  metadata?: Record<string, unknown> | object;
}

const requestContextStorage: Pick<
  AsyncLocalStorage<RequestContext>,
  'getStore' | 'run'
> = (AsyncLocalStorage as unknown) === undefined
  ? {
      getStore: () => undefined,
      run: (_store: RequestContext, callback: () => void) => {
        callback();
      },
    }
  : new AsyncLocalStorage<RequestContext>();

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

export { getColor, getRequestContext, getSessionId, requestContextStorage };
export type { RequestContext };
