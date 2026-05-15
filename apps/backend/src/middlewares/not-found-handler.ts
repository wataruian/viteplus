import type { ExpressNextFunction, ExpressRequest, ExpressResponse } from '../types/middlware';
import {
  apiDocsEndpoint,
  apiEndpoint,
  trpcDocsEndpoint,
  trpcEndpoint,
  trpcPlaygroundEndpoint,
} from '@lightproject/common/configs';
import { httpRouter } from '../routers/http';
import { isLocal } from '@lightproject/common/environment';
import { isRecord } from '@lightproject/common/validators';
import { trpcRouter } from '../routers/trpc';

const trailingSlashesRegex = /\/+$/;

const getHttpRouterPaths = (
  router: Record<string, { handler: unknown; method: string }>[],
): string[] => {
  const paths: string[] = [];
  for (const routeObj of router) {
    for (const path of Object.keys(routeObj)) {
      paths.push(path);
    }
  }
  return paths;
};

const getTrpcProcedureKeys = (node: unknown, prefix = ''): string[] => {
  const keys: string[] = [];
  if (!isRecord(node)) {
    return keys;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('_def')) {
      continue;
    }
    const defRaw: unknown = typeof value === 'function' ? Reflect.get(value, '_def') : undefined;
    const def = isRecord(defRaw) ? defRaw : undefined;
    if (isRecord(def)) {
      keys.push(`${prefix}${key}`);
    } else if (isRecord(value)) {
      keys.push(...getTrpcProcedureKeys(value, `${prefix}${key}.`));
    }
  }
  return keys;
};

const notFoundHandler = (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
  if (isLocal()) {
    const swaggerHttpPath = apiDocsEndpoint.replace(trailingSlashesRegex, '');
    const swaggerTrpcPath = trpcDocsEndpoint.replace(trailingSlashesRegex, '');
    const trpcPlaygroundPath = trpcPlaygroundEndpoint.replace(trailingSlashesRegex, '');

    const normalizedUrl = req.originalUrl.replace(trailingSlashesRegex, '');

    if (
      normalizedUrl === swaggerHttpPath ||
      normalizedUrl === swaggerTrpcPath ||
      normalizedUrl === trpcPlaygroundPath
    ) {
      next();
      return;
    }
  }

  const normalizedApiEndpoint = apiEndpoint.replace(trailingSlashesRegex, '');
  const normalizedTrpcEndpoint = trpcEndpoint.replace(trailingSlashesRegex, '');

  const httpPathsRaw = getHttpRouterPaths(httpRouter).map((path) =>
    path.startsWith(normalizedApiEndpoint)
      ? path
      : `${normalizedApiEndpoint}${path.startsWith('/') ? '' : '/'}${path}`,
  );
  const httpPathsSet = new Set(httpPathsRaw.map((p) => p.replace(/\/$/, '')));
  const httpPaths: string[] = [];
  for (const path of httpPathsSet) {
    if (path === '') {
      continue;
    }
    httpPaths.push(path);
    if (path === normalizedApiEndpoint) {
      httpPaths.push(`${normalizedApiEndpoint}/`);
    }
  }

  const trpcPaths = getTrpcProcedureKeys(trpcRouter).map((path) =>
    path.startsWith(normalizedTrpcEndpoint)
      ? path
      : `${normalizedTrpcEndpoint}${path.startsWith('/') ? '' : '/'}${path}`,
  );

  const { pathname } = new globalThis.URL(req.originalUrl, 'http://localhost');

  const normalizedHttpPath = pathname.replace(trailingSlashesRegex, '');
  const normalizedTrpcPath = pathname.replace(/\/batch$/, '').replace(trailingSlashesRegex, '');

  const isHttpEndpoint =
    httpPaths.includes(normalizedHttpPath) || httpPaths.includes(`${normalizedHttpPath}/`);
  const isTrpcEndpoint = trpcPaths.includes(normalizedTrpcPath);

  const isValidEndpoint = isHttpEndpoint || isTrpcEndpoint;

  if (!isValidEndpoint) {
    const statusCode = 404;
    const error = new Error('Not Found');

    Object.assign(error, {
      name: 'NotFoundError',
      stack: 'No stack trace available',
      statusCode,
    });
    res.status(statusCode);
    next(error);
  }

  next();
};

export { getHttpRouterPaths, getTrpcProcedureKeys, notFoundHandler };
