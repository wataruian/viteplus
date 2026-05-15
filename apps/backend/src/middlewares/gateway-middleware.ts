import {
  type Locals,
  type MiddlewareLoggingOptionsType,
  type Request,
  type Response,
  assertIsCustomRequest,
  assertIsCustomResponse,
} from '../types/middlware';
import type express from 'express';
import { isRecord } from '@lightproject/common/validators';
import { requestHandler } from './request-handler';
import { responseHandler } from './response-handler';
import { safeClone } from '@lightproject/common/utils';

const loggingOptions: MiddlewareLoggingOptionsType = {
  logBody: false,
  logHeaders: false,
  logParams: false,
  logQuery: false,
};

const cleanLocals = (locals: Record<string, unknown>): void => {
  if ('originalStatusCode' in locals) {
    delete locals['originalStatusCode'];
  }
  if ('responseBody' in locals) {
    delete locals['responseBody'];
  }
};

const syncLocals = ({
  locals,
  req,
  res,
  target = 'both',
}: {
  locals: Partial<Locals>;
  req?: null | Request | undefined;
  res?: null | Response | undefined;
  target?: 'both' | 'req' | 'res';
}): void => {
  if (!['both', 'req', 'res'].includes(target)) {
    throw new TypeError('Target must be either "both", "req", or "res"');
  }

  if (req === undefined && res === undefined) {
    throw new Error('Either req or res must be provided to sync local variables');
  }

  const allLocalsRaw = safeClone({
    ...req?.locals,
    ...res?.locals,
    ...locals,
  });

  if (!isRecord(allLocalsRaw)) {
    throw new Error('Failed to clone locals');
  }

  const allLocals = allLocalsRaw;

  if (req !== null && req !== undefined && (target === 'req' || target === 'both')) {
    const reqLocals = { ...allLocals };
    cleanLocals(reqLocals);
    Object.assign(req.locals, reqLocals);
  }

  if (res !== null && res !== undefined && (target === 'res' || target === 'both')) {
    const resLocals = { ...allLocals };
    Object.assign(res.locals, resLocals);
  }
};

const gatewayMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void => {
  try {
    assertIsCustomRequest(req);
    assertIsCustomResponse(res);
    requestHandler(req, res, next);
    res.on('finish', () => {
      try {
        responseHandler(req, res, next);
      } catch (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
};

export { gatewayMiddleware, loggingOptions, syncLocals };
