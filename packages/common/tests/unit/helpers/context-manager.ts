import { AsyncLocalStorage } from 'node:async_hooks';

import { type Context, type ContextManager, ROOT_CONTEXT } from '@opentelemetry/api';

const createAsyncHooksContextManager = (): ContextManager => {
  const storage = new AsyncLocalStorage<Context>();

  const manager: ContextManager = {
    active: () => storage.getStore() ?? ROOT_CONTEXT,
    bind: (_activeContext, target) => target,
    disable: () => manager,
    enable: () => manager,
    with: (activeContext, fn, thisArg, ...args) =>
      storage.run(activeContext, () => fn.call(thisArg, ...args)),
  };

  return manager;
};

export { createAsyncHooksContextManager };
