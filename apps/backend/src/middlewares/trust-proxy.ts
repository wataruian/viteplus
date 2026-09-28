import { isCi, isLocal, isOtherEnvironment, isTest } from '@lightproject/common/environment';
import { logger } from '@lightproject/common/logger';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import { config } from '../config';
import type { AppEnv, NodeBindings } from '../schema';

const ipv4MappedPrefix = '::ffff:';

const normalizeIp = (ip: string): string => {
  const trimmed = ip.trim();
  return trimmed.toLowerCase().startsWith(ipv4MappedPrefix) && trimmed.includes('.')
    ? trimmed.slice(ipv4MappedPrefix.length)
    : trimmed;
};

const parseIpList = (raw?: string): string[] =>
  raw === undefined
    ? []
    : raw
        .split(',')
        .map((ip) => normalizeIp(ip))
        .filter((ip) => ip !== '');

const getSocketAddress = (env: NodeBindings | undefined): string | undefined =>
  env?.incoming?.socket?.remoteAddress;

const getRequestIp = (c: Context<AppEnv>): string => {
  const socketAddress = getSocketAddress(c.env);

  if (socketAddress === undefined) {
    return normalizeIp(c.req.header('cf-connecting-ip') ?? '');
  }

  const peer = normalizeIp(socketAddress);
  const trustedProxies = new Set(parseIpList(config.trustedProxies));
  if (!trustedProxies.has(peer)) {
    return peer;
  }

  const hops = parseIpList(c.req.header('x-forwarded-for'));
  return hops.findLast((hop) => !trustedProxies.has(hop)) ?? peer;
};

const getAllowedIps = (additionalIps?: string): Set<string> =>
  new Set(['127.0.0.1', '::1', ...parseIpList(additionalIps)]);

const trustProxy = () =>
  createMiddleware<AppEnv>(async (c, next) => {
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

export { getAllowedIps, getRequestIp, getSocketAddress, normalizeIp, parseIpList, trustProxy };
