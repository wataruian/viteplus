import type { Request, Response, ServiceContext } from '../types/middlware';
import { type TrpcRouter, trpcRouter } from '../routers/trpc';
import { createContext, transformer } from './trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { trpcEndpoint, trpcUrl } from '@lightproject/common/configs';
import type { Express } from 'express';
import { URL } from 'node:url';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { isRecord } from '@lightproject/common/validators';
import { logger } from '@lightproject/common/logger';

const createCaller = (ctx: ServiceContext) => trpcRouter.createCaller(ctx);

const trpcClient = createTRPCClient<TrpcRouter>({
  links: [
    httpBatchLink({
      transformer,
      url: trpcUrl,
    }),
  ],
});

const isRequest = (req: Express.Request): req is Request => 'locals' in req;
const isResponse = (res: Express.Response): res is Response => 'locals' in res;

const registerTrpcRoutes = (app: Express, rootPath: string = trpcEndpoint): void => {
  try {
    app.use(rootPath, (req, _res, next) => {
      const bodyRecord: unknown = req.body;
      const isBatch =
        req.query['batch'] !== undefined ||
        (isRecord(bodyRecord) && Object.keys(bodyRecord).every((key) => /^\d+$/u.test(key)));

      if (req.method === 'POST' && isRecord(bodyRecord) && !isBatch && !('json' in bodyRecord)) {
        req.body = { json: bodyRecord };
      }

      if (['DELETE', 'GET', 'HEAD'].includes(req.method)) {
        if (typeof req.query['input'] === 'string') {
          try {
            const parsed: unknown = JSON.parse(req.query['input']);
            if (isRecord(parsed) && !('json' in parsed)) {
              const url = new URL(req.url, 'http://localhost');
              url.searchParams.set('input', JSON.stringify({ json: parsed }));
              req.url = url.pathname + url.search;
            }
          } catch {
            // Ignore JSON parse errors and delegate to tRPC validator
          }
        } else if (Object.keys(req.query).length > 0) {
          const url = new URL(req.url, 'http://localhost');
          const queryParams: Record<string, string> = {};
          for (const [key, value] of url.searchParams.entries()) {
            queryParams[key] = value;
          }
          url.search = '';
          url.searchParams.set('input', JSON.stringify({ json: queryParams }));
          req.url = url.pathname + url.search;
        }
      }
      next();
    });

    app.use(
      rootPath,
      createExpressMiddleware({
        createContext: ({ req, res }): ServiceContext => {
          if (!isRequest(req) || !isResponse(res)) {
            throw new Error('Invalid request or response context: missing locals');
          }
          return createContext(req, res);
        },
        router: trpcRouter,
      }),
    );
  } catch (error) {
    logger.error(
      'Failed to register tRPC routes:',
      isRecord(error) ? error : { error: String(error) },
    );
    throw error;
  }
};

type AppRouterCaller = ReturnType<typeof createCaller>;
type AppRouterPaths = ExtractRouterPaths<TrpcRouter>;

type ExtractRouterPaths<T> = T extends object
  ? {
      [K in keyof T]: T[K] extends object
        ? K extends string
          ? {
              [P in keyof T[K]]: P extends string ? `${K}.${P}` : never;
            }[keyof T[K]]
          : never
        : never;
    }[keyof T]
  : never;

type TrpcRouterPaths<T> = T extends object
  ? {
      [K in keyof T]: T[K] extends (...args: unknown[]) => unknown
        ? K
        : T[K] extends object
          ? K extends string
            ? `${K}.${string & TrpcRouterPaths<T[K]>}`
            : never
          : K;
    }[keyof T]
  : never;

export type { AppRouterCaller, AppRouterPaths, TrpcRouterPaths, ExtractRouterPaths };
export { createCaller, trpcClient, registerTrpcRoutes };
