import { isTrpcEndpoint } from '@lightproject/common/configs';
import {
  isCi,
  isDebug,
  isLocal,
  isNonProduction,
  isOtherEnvironment,
  isTest,
} from '@lightproject/common/environment';
import { logger } from '@lightproject/common/logger';

import { config } from '../config';
import { errorHandler } from './gateway-middleware';
import type { NextFunction, Request, Response } from './initialize-request';

const logDebugTruthTable = (
  isIpAllowed: boolean,
  inSafeEnv: boolean,
  allowAll: boolean,
  blockAll: boolean,
  isAllowed: boolean,
) => {
  if (isNonProduction() && isDebug()) {
    const bools = [false, true];
    logger.debug('--- trustProxy decision truth table ---');
    for (const ipAllowed of bools) {
      for (const safe of bools) {
        for (const allow of bools) {
          for (const block of bools) {
            const allowedByBlock = !block;
            const allowedByAllow = allow;
            const allowedByEnv = ipAllowed || safe;
            const decision = allowedByBlock && (allowedByAllow || allowedByEnv);
            logger.debug(
              `isIpAllowed=${ipAllowed}, inSafeEnv=${safe}, allowAll=${allow}, blockAll=${block} => isAllowed=${decision}`,
            );
          }
        }
      }
    }
    logger.debug('--- actual flags ---');
    logger.debug(
      `isIpAllowed=${isIpAllowed}, inSafeEnv=${inSafeEnv}, allowAll=${allowAll}, blockAll=${blockAll} => isAllowed=${isAllowed}`,
    );
  }
};

const handleAccessDenied = (req: Request, res: Response, next: NextFunction) => {
  const statusCode = 403;
  const error = new Error('Access denied');

  Object.assign(error, {
    name: 'AccessDeniedError',
    stack: error.stack,
    statusCode,
  });

  res.status(statusCode);

  if (isTrpcEndpoint(req.originalUrl)) {
    errorHandler(error, req, res, next);
  } else {
    next(error);
  }
};

const trustProxyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const allowedIps = new Set(['127.0.0.1', '::1']);

  const additionalIps = config.allowedIps;
  if (additionalIps !== undefined && additionalIps !== '') {
    for (const ip of additionalIps.split(',')) {
      const trimmed = ip.trim();
      if (trimmed !== '') {
        allowedIps.add(trimmed);
      }
    }
  }

  const requestIp = req.ip ?? req.socket.remoteAddress;

  const isIpAllowed = requestIp !== undefined && requestIp !== '' && allowedIps.has(requestIp);
  const inSafeEnv = isLocal() || isTest() || isCi() || isOtherEnvironment();
  const allowAll = config.allowAllIps;
  const blockAll = config.blockAllIps;

  // Precedence: blockAll > allowAll > (isIpAllowed || inSafeEnv)
  const isAllowed = !blockAll && (allowAll || isIpAllowed || inSafeEnv);

  logDebugTruthTable(isIpAllowed, inSafeEnv, allowAll, blockAll, isAllowed);

  if (isAllowed) {
    next();
  } else {
    handleAccessDenied(req, res, next);
  }
};

export { handleAccessDenied, logDebugTruthTable, trustProxyMiddleware };
