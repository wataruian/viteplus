import type {
  Locals,
  MiddlewareLoggingOptionsType,
  NextFunction,
  Request,
  Response,
} from '../types/middlware';
import { requestHandler } from './request-handler';
import { responseHandler } from './response-handler';
import { safeClone } from '@lightproject/common/utils';

const loggingOptions: MiddlewareLoggingOptionsType = {
  logBody: false,
  logHeaders: false,
  logParams: false,
  logQuery: false,
};

const syncLocals = ({
  locals,
  req,
  res,
  target = 'both',
}: {
  locals: Partial<Locals> | Partial<Request['locals']> | Partial<Response['locals']>;
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
    throw new Error('Either req or res must be provided to sync local variables');
  }

  const allLocals = safeClone({
    ...req?.locals,
    ...res?.locals,
    ...locals,
  });

  if (req && (target === 'req' || target === 'both')) {
    const reqLocals = safeClone(allLocals || {});
    if (reqLocals['originalStatusCode']) {
      delete reqLocals['originalStatusCode'];
    }
    if (reqLocals['responseBody']) {
      delete reqLocals['responseBody'];
    }
    req.locals = {
      ...req.locals,
      ...reqLocals,
    };
  }

  if (res && (target === 'res' || target === 'both')) {
    const resLocals = safeClone(allLocals || {});
    res.locals = safeClone({
      ...res.locals,
      ...resLocals,
    });
  }
};

const gatewayMiddleware = (req: Request, res: Response, next: NextFunction): void => {
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

export { gatewayMiddleware, loggingOptions, syncLocals };
