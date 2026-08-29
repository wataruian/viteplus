import { isCi, isLocal, isOtherEnvironment, isTest } from '@lightproject/common/environment';
import { logger } from '@lightproject/common/logger';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import { config } from '../config';

interface NodeEnv {
  incoming?: { socket?: { remoteAddress?: unknown } };
}

const isNodeEnv = (env: unknown): env is NodeEnv => typeof env === 'object' && env !== null;

const getRequestIp = (c: Parameters<MiddlewareHandler>[0]): string => {
  let remoteAddress: string | undefined = undefined;

  const env: unknown = c.env;
  if (isNodeEnv(env)) {
    const { incoming } = env;
    const socket = incoming?.socket;
    const addr = socket?.remoteAddress;
    remoteAddress = typeof addr === 'string' ? addr : undefined;
  }

  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
    c.req.header('x-real-ip') ??
    c.req.header('cf-connecting-ip') ??
    remoteAddress ??
    ''
  );
};

const getAllowedIps = (additionalIps?: string): Set<string> => {
  const allowedIps = new Set(['127.0.0.1', '::1']);
  if (additionalIps !== undefined && additionalIps !== '') {
    for (const ip of additionalIps.split(',')) {
      const trimmed = ip.trim();
      if (trimmed !== '') {
        allowedIps.add(trimmed);
      }
    }
  }
  return allowedIps;
};

const trustProxy = () =>
  createMiddleware(async (c, next) => {
    const allowedIps = getAllowedIps(config.allowedIps);
    const requestIp = getRequestIp(c);

    const isIpAllowed = requestIp !== '' && allowedIps.has(requestIp);
    const inSafeEnv = isLocal() || isTest() || isCi() || isOtherEnvironment();
    const allowAll = config.allowAllIps;
    const blockAll = config.blockAllIps;

    const isAllowed = !blockAll && (allowAll || isIpAllowed || inSafeEnv);

    if (!isAllowed) {
      logger.warn(`Access denied for IP: ${requestIp || 'unknown'}`);
      throw new HTTPException(403, { message: 'Access denied.' });
    }

    logger.debug(`Access allowed for IP: ${requestIp || 'unknown'}`);

    await next();
  });

export { getAllowedIps, getRequestIp, isNodeEnv, trustProxy };
export type { NodeEnv };
