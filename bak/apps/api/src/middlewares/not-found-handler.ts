import { parse } from 'node:url';
import { endpoints } from '@lightproject/common/configs';
import { isLocal } from '@lightproject/common/environment';
import { httpRouter } from '../routers/http';
import { trpcRouter } from '../routers/trpc';
import type {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from '../types/middlware';

const TRAILING_SLASHES_REGEX = /\/+$/;
const HTTP_PATH_REGEX = /\/$/;
const BATCH_SUFFIX_REGEX = /\/batch$/;

export const getHttpRouterPaths = (
  httpRouter: Record<string, { handler: unknown; method: string }>[]
): string[] => {
  const paths: string[] = [];
  for (const routeObj of httpRouter) {
    for (const path of Object.keys(routeObj)) {
      paths.push(path);
    }
  }
  return paths;
};

export const getTrpcProcedureKeys = (node: unknown, prefix = ''): string[] => {
  const keys: string[] = [];
  if (typeof node !== 'object' || node === null) {
    return keys;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key.startsWith('_def')) {
      continue;
    }
    if (
      typeof value === 'function' &&
      (value as { _def?: unknown })._def !== undefined
    ) {
      keys.push(`${prefix}${key}`);
    } else if (typeof value === 'object' && value !== null) {
      keys.push(...getTrpcProcedureKeys(value, `${prefix}${key}.`));
    }
  }
  return keys;
};

export const notFoundHandler = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNextFunction
) => {
  if (isLocal()) {
    const swaggerHttpPath = endpoints.apiDocsEndpoint.replace(
      TRAILING_SLASHES_REGEX,
      ''
    );
    const swaggerTrpcPath = endpoints.trpcDocsEndpoint.replace(
      TRAILING_SLASHES_REGEX,
      ''
    );
    const trpcPlaygroundPath = endpoints.trpcPlaygroundEndpoint.replace(
      TRAILING_SLASHES_REGEX,
      ''
    );

    const normalizedUrl = req.originalUrl.replace(TRAILING_SLASHES_REGEX, '');

    if (
      normalizedUrl === swaggerHttpPath ||
      normalizedUrl === swaggerTrpcPath ||
      normalizedUrl === trpcPlaygroundPath
    ) {
      return next();
    }
  }

  const apiEndpoint = endpoints.apiEndpoint.replace(TRAILING_SLASHES_REGEX, '');
  const trpcEndpoint = endpoints.trpcEndpoint.replace(
    TRAILING_SLASHES_REGEX,
    ''
  );

  const httpPathsRaw = getHttpRouterPaths(httpRouter).map(path => {
    return path.startsWith(apiEndpoint)
      ? path
      : `${apiEndpoint}${path.startsWith('/') ? '' : '/'}${path}`;
  });
  const httpPathsSet = new Set(
    httpPathsRaw.map(p => p.replace(HTTP_PATH_REGEX, ''))
  );
  const httpPaths: string[] = [];
  for (const path of httpPathsSet) {
    if (path === '') {
      continue;
    }
    httpPaths.push(path);
    if (path === apiEndpoint) {
      httpPaths.push(`${apiEndpoint}/`);
    }
  }

  const trpcPaths = getTrpcProcedureKeys(trpcRouter).map(path => {
    return path.startsWith(trpcEndpoint)
      ? path
      : `${trpcEndpoint}${path.startsWith('/') ? '' : '/'}${path}`;
  });

  const { pathname = '' } = parse(req.originalUrl);

  const normalizedHttpPath = (pathname ?? '').replace(
    TRAILING_SLASHES_REGEX,
    ''
  );
  const normalizedTrpcPath = (pathname ?? '')
    .replace(BATCH_SUFFIX_REGEX, '')
    .replace(TRAILING_SLASHES_REGEX, '');

  const isHttpEndpoint =
    httpPaths.includes(normalizedHttpPath) ||
    httpPaths.includes(`${normalizedHttpPath}/`);
  const isTrpcEndpoint = trpcPaths.includes(normalizedTrpcPath);

  const isValidEndpoint = isHttpEndpoint || isTrpcEndpoint;

  if (!isValidEndpoint) {
    const statusCode = 404;
    const error = {
      message: 'Not Found',
      name: 'NotFoundError',
      stack: 'No stack trace available',
      statusCode,
    };
    res.status(statusCode);
    next?.(error);
  }

  next();
};
