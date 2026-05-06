import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { endpoints } from '@lightproject/common/configs';
import { color } from '@lightproject/common/utils';
import type { ChalkInstance } from 'chalk';
import cryptoJs from 'crypto-js';

const uuidv4 = () => randomUUID();

import { logger } from '@lightproject/common/logger';

import type {
  Locals,
  NextFunction,
  Request,
  Response,
} from '../types/middlware';

import { syncLocals } from './gateway-middleware';

const asyncLocalStorage = new AsyncLocalStorage();

let previousColor: ChalkInstance | undefined;

export const initializeRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.locals) {
      req.locals = {} as Request['locals'];
    }

    const sessionId = uuidv4();

    ({ nextColor: req.locals.color, previousColor } = color.getNextRandomColor(
      cryptoJs.SHA256(sessionId.toString()).toString(),
      previousColor ?? color.defaultColor
    ));

    if (!req.locals.color) {
      req.locals.color = color.getRandomColor();
    }

    previousColor = req.locals.color;

    const locals: Locals = {
      ...req.locals,
      metadata: {
        method: req.method,
        requestType: endpoints.getRequestType(req.originalUrl),
        source: 'initializeRequest',
        startTime: Date.now(),
        url: req.originalUrl,
      },
      sessionId,
    };

    syncLocals({
      locals,
      req,
      target: 'req',
    });

    logger.info(`Initializing [${req.method}] request session`, req.locals);

    asyncLocalStorage.run(new Map<string, Locals>([['locals', locals]]), () => {
      res.locals = req.locals;
      res.locals.originalStatusCode = res.statusCode;
      next();
    });
  } catch (error) {
    next(error);
  }
};

export const getSessionId = () => {
  const store = asyncLocalStorage.getStore();
  return store
    ? ((store as Map<string, Locals>).get('locals')?.sessionId ?? 'no-id')
    : 'no-id';
};

export const getColor = () => {
  const store = asyncLocalStorage.getStore();
  return store
    ? ((store as Map<string, Locals | undefined>).get('locals')?.color ??
        color.getRandomColor())
    : color.getRandomColor();
};

export const getLocals = () => {
  const store = asyncLocalStorage.getStore();
  return store
    ? (store as Map<string, Locals>).get('locals')
    : { color: color.getRandomColor(), sessionId: 'no-id' };
};
