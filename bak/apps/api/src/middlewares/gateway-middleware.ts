import { utils } from '@lightproject/common';

import type {
  Locals,
  MiddlewareLoggingOptionsType,
  NextFunction,
  Request,
  Response,
} from '../types/middlware';

import { requestHandler } from './request-handler';
import { responseHandler } from './response-handler';

export const loggingOptions: MiddlewareLoggingOptionsType = {
  logBody: false,
  logHeaders: false,
  logParams: false,
  logQuery: false,
};

export const syncLocals = ({
  locals,
  req,
  res,
  target = 'both',
}: {
  locals:
    | Partial<Locals>
    | Partial<Request['locals']>
    | Partial<Response['locals']>;
  req?: null | Request | undefined;
  res?: null | Response | undefined;
  target?: 'both' | 'req' | 'res';
}): void => {
  if (typeof target !== 'string' || !['both', 'req', 'res'].includes(target)) {
    throw new Error('Target must be either "both", "req", or "res"');
  }

  if (!locals) {
    throw new Error('Locals must be provided to sync local variables');
  }

  if (!(req || res)) {
    throw new Error(
      'Either req or res must be provided to sync local variables'
    );
  }

  const allLocals = utils.serialize.safeClone({
    ...(req?.locals ? req.locals : {}),
    ...(res?.locals ? res.locals : {}),
    ...locals,
  });

  if (req && (target === 'req' || target === 'both')) {
    const reqLocals = utils.serialize.safeClone(allLocals || {});
    if (reqLocals['originalStatusCode']) {
      // biome-ignore lint/performance/noDelete: ignore
      delete reqLocals['originalStatusCode'];
    }
    if (reqLocals['responseBody']) {
      // biome-ignore lint/performance/noDelete: ignore
      delete reqLocals['responseBody'];
    }
    req.locals = {
      ...req.locals,
      ...reqLocals,
    };
  }

  if (res && (target === 'res' || target === 'both')) {
    const resLocals = utils.serialize.safeClone(allLocals || {});
    res.locals = utils.serialize.safeClone({
      ...res.locals,
      ...resLocals,
    });
  }
};

export const gatewayMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    requestHandler(req, res, next);
    res.on('finish', () => {
      try {
        responseHandler(req, res, next);
      } catch (error) {
        next(error);
      }
    });
    // next();
  } catch (error) {
    next(error);
  }
};
