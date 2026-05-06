import { endpoints } from '@lightproject/common/configs';
import {
  isCi,
  isLocal,
  isNonProduction,
  isOtherEnvironment,
  isTest,
} from '@lightproject/common/environment';
import { logger } from '@lightproject/common/logger';

import type {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
  Request,
  Response,
} from '../types/middlware';

import { errorHandler } from './error-handler';

const logDebugTruthTable = (
  isLoopback: boolean,
  inSafeEnv: boolean,
  allowAll: boolean,
  blockAll: boolean,
  isAllowed: boolean
) => {
  if (!isNonProduction() || process.env['DEBUG'] !== 'true') {
    return;
  }

  const bools = [false, true];
  logger.debug('--- trustProxy decision truth table ---');
  for (const loopback of bools) {
    for (const safe of bools) {
      for (const allow of bools) {
        for (const block of bools) {
          const allowedByBlock = !block;
          const allowedByAllow = allow;
          const allowedByEnv = loopback || safe;
          const decision = allowedByBlock && (allowedByAllow || allowedByEnv);
          logger.debug(
            `isLoopback=${loopback}, inSafeEnv=${safe}, allowAll=${allow}, blockAll=${block} => isAllowed=${decision}`
          );
        }
      }
    }
  }
  logger.debug('--- actual flags ---');
  logger.debug(
    `isLoopback=${isLoopback}, inSafeEnv=${inSafeEnv}, allowAll=${allowAll}, blockAll=${blockAll} => isAllowed=${isAllowed}`
  );
};

const handleAccessDenied = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction
) => {
  const statusCode = 403;
  const error = {
    message: 'Access denied',
    name: 'AccessDeniedError',
    stack: 'No stack trace available',
    statusCode,
  };

  res.status(statusCode);

  if (endpoints.isTrpcEndpoint(req.originalUrl)) {
    errorHandler(
      error,
      req as unknown as Request,
      res as unknown as Response,
      next
    );
  } else {
    next(error);
  }
};

export const trustProxyMiddleware = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction
) => {
  const allowedIps = new Set(['127.0.0.1', '::1']);
  const requestIp = req.ip || req.socket.remoteAddress;

  const isLoopback = !!requestIp && allowedIps.has(requestIp);
  const inSafeEnv = isLocal() || isTest() || isCi() || isOtherEnvironment();
  const allowAll = process.env['ALLOW_ALL_IPS'] === 'true';
  const blockAll = process.env['BLOCK_ALL_IPS'] === 'true';

  // Precedence: blockAll > allowAll > (isLoopback || inSafeEnv)
  const isAllowed = !blockAll && (allowAll || isLoopback || inSafeEnv);

  logDebugTruthTable(isLoopback, inSafeEnv, allowAll, blockAll, isAllowed);

  if (isAllowed) {
    next();
  } else {
    handleAccessDenied(req, res, next);
  }
};
