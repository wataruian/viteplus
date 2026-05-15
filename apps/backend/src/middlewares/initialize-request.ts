import { AsyncLocalStorage } from 'node:async_hooks';
import type { Locals } from '../types/middlware';
import type express from 'express';
import { getRandomColor } from '@lightproject/common/utils';
import { getRequestType } from '@lightproject/common/configs';
import { logger } from '@lightproject/common/logger';
import { randomUUID } from 'node:crypto';

const uuidv4 = () => randomUUID();

const asyncLocalStorage = new AsyncLocalStorage();

const initializeRequest = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  try {
    const sessionId = uuidv4();

    const initialLocals: Locals = {
      color: getRandomColor(sessionId),
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

    logger.info(`Initializing [${req.method}] request session`, initialLocals);

    asyncLocalStorage.run(new Map<string, Locals>([['locals', initialLocals]]), () => {
      next();
    });
  } catch (error) {
    next(error);
  }
};

const isLocalsMap = (v: unknown): v is Map<string, Locals> => v instanceof Map;

const getSessionId = () => {
  const store = asyncLocalStorage.getStore();
  return isLocalsMap(store) ? (store.get('locals')?.sessionId ?? 'no-id') : 'no-id';
};

const getColor = () => {
  const store = asyncLocalStorage.getStore();
  return isLocalsMap(store) ? (store.get('locals')?.color ?? getRandomColor()) : getRandomColor();
};

const getLocals = () => {
  const store = asyncLocalStorage.getStore();
  return isLocalsMap(store)
    ? (store.get('locals') ?? { color: getRandomColor(), sessionId: 'no-id' })
    : { color: getRandomColor(), sessionId: 'no-id' };
};

export { initializeRequest, getSessionId, getColor, getLocals };
