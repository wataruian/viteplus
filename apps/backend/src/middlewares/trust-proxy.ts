import {
  type ExpressNextFunction,
  type ExpressRequest,
  type ExpressResponse,
  assertIsCustomRequest,
  assertIsCustomResponse,
} from '../types/middlware';
import {
  isCi,
  isLocal,
  isNonProduction,
  isOtherEnvironment,
  isTest,
} from '@lightproject/common/environment';
import { errorHandler } from './error-handler';
import { isTrpcEndpoint } from '@lightproject/common/configs';
import { logger } from '@lightproject/common/logger';

const logDebugTruthTable = (
  isLoopback: boolean,
  inSafeEnv: boolean,
  allowAll: boolean,
  blockAll: boolean,
  isAllowed: boolean,
) => {
  if (isNonProduction() && globalThis.process.env['DEBUG'] === 'true') {
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
              `isLoopback=${loopback}, inSafeEnv=${safe}, allowAll=${allow}, blockAll=${block} => isAllowed=${decision}`,
            );
          }
        }
      }
    }
    logger.debug('--- actual flags ---');
    logger.debug(
      `isLoopback=${isLoopback}, inSafeEnv=${inSafeEnv}, allowAll=${allowAll}, blockAll=${blockAll} => isAllowed=${isAllowed}`,
    );
  }
};

const handleAccessDenied = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction,
) => {
  const statusCode = 403;
  const error = new Error('Access denied');
  Object.assign(error, {
    name: 'AccessDeniedError',
    stack: 'No stack trace available',
    statusCode,
  });

  res.status(statusCode);

  if (isTrpcEndpoint(req.originalUrl)) {
    assertIsCustomRequest(req);
    assertIsCustomResponse(res);
    errorHandler(error, req, res, next);
  } else {
    next(error);
  }
};

const trustProxyMiddleware = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction,
) => {
  const allowedIps = new Set(['127.0.0.1', '::1']);
  const requestIp = req.ip ?? req.socket.remoteAddress;

  const isLoopback = requestIp !== undefined && requestIp !== '' && allowedIps.has(requestIp);
  const inSafeEnv = isLocal() || isTest() || isCi() || isOtherEnvironment();
  const allowAll = globalThis.process.env['ALLOW_ALL_IPS'] === 'true';
  const blockAll = globalThis.process.env['BLOCK_ALL_IPS'] === 'true';

  // Precedence: blockAll > allowAll > (isLoopback || inSafeEnv)
  const isAllowed = !blockAll && (allowAll || isLoopback || inSafeEnv);

  logDebugTruthTable(isLoopback, inSafeEnv, allowAll, blockAll, isAllowed);

  if (isAllowed) {
    next();
  } else {
    handleAccessDenied(req, res, next);
  }
};

export { logDebugTruthTable, handleAccessDenied, trustProxyMiddleware };
