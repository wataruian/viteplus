import type { NextFunction, Request, Response } from './initialize-request';
import {
  apiEndpoint,
  docsEndpoint,
  trpcEndpoint,
  trpcPlaygroundEndpoint,
} from '@lightproject/common/configs';
import { httpRouter } from '../routers/http';
import { isLocal } from '@lightproject/common/environment';
import { trpcRouter } from '../routers/trpc';

const stripTrailingSlashes = (str: string) => str.replace(/\/+$/u, '');

const prefixPath = (path: string, prefix: string) =>
  path.startsWith(prefix) ? path : `${prefix}${path.startsWith('/') ? '' : '/'}${path}`;

const getHttpRouterPaths = (router: Record<string, object>[]): string[] =>
  router.flatMap((r) => Object.keys(r));

const getTrpcProcedureKeys = (node: object, prefix = ''): string[] => {
  const getProperty = Reflect.get as (
    o: object,
    k: string,
  ) => object | ((...args: never[]) => object | undefined) | undefined;
  const getPropertyDef = Reflect.get as (o: object, k: string) => object | undefined;

  return Object.keys(node).flatMap((key) => {
    if (key.startsWith('_def')) {
      return [];
    }
    const value = getProperty(node, key);
    const def = typeof value === 'function' ? getPropertyDef(value, '_def') : undefined;
    if (def !== undefined && typeof def === 'object') {
      return [`${prefix}${key}`];
    }
    if (typeof value === 'object') {
      return getTrpcProcedureKeys(value, `${prefix}${key}.`);
    }
    return [];
  });
};

const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  if (isLocal()) {
    const swaggerPath = stripTrailingSlashes(docsEndpoint);
    const trpcPlaygroundPath = stripTrailingSlashes(trpcPlaygroundEndpoint);
    const normalizedUrl = stripTrailingSlashes(req.originalUrl);

    if (normalizedUrl === swaggerPath || normalizedUrl === trpcPlaygroundPath) {
      next();
    }
  }

  const normalizedApiEndpoint = stripTrailingSlashes(apiEndpoint);
  const normalizedTrpcEndpoint = stripTrailingSlashes(trpcEndpoint);

  const httpPathsRaw = getHttpRouterPaths(httpRouter).map((p) =>
    prefixPath(p, normalizedApiEndpoint),
  );
  const httpPaths = new Set(
    httpPathsRaw
      .map((p) => p.replace(/\/$/u, ''))
      .filter(Boolean)
      .flatMap((path) =>
        path === normalizedApiEndpoint ? [path, `${normalizedApiEndpoint}/`] : [path],
      ),
  );

  const trpcPaths = new Set(
    getTrpcProcedureKeys(trpcRouter).map((p) => prefixPath(p, normalizedTrpcEndpoint)),
  );

  const { pathname } = new globalThis.URL(req.originalUrl, 'http://localhost');
  const normalizedHttpPath = stripTrailingSlashes(pathname);
  const normalizedTrpcPath = stripTrailingSlashes(pathname.replace(/\/batch$/u, ''));

  const isHttpEndpoint =
    httpPaths.has(normalizedHttpPath) || httpPaths.has(`${normalizedHttpPath}/`);
  const isTrpcEndpoint = trpcPaths.has(normalizedTrpcPath);

  if (!isHttpEndpoint && !isTrpcEndpoint) {
    const statusCode = 404;
    const error = new Error('Not Found');
    Object.assign(error, {
      name: 'NotFoundError',
      stack: error.stack,
      statusCode,
    });
    res.status(statusCode);
    next(error);
  }

  next();
};

export {
  stripTrailingSlashes,
  prefixPath,
  getHttpRouterPaths,
  getTrpcProcedureKeys,
  notFoundHandler,
};
