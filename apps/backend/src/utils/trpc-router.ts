import {
  type ExpressRequest,
  type ExpressResponse,
  type ServiceContext,
  assertIsCustomRequest,
  assertIsCustomResponse,
} from '../types/middlware';
import { type TrpcRouter, trpcRouter } from '../routers/trpc';
import { createContext, transformer } from './trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { trpcEndpoint, trpcUrl } from '@lightproject/common/configs';
import type { Express } from 'express';
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

const registerTrpcRoutes = (app: Express, rootPath: string = trpcEndpoint) => {
  try {
    app.use(rootPath, (req, _res, next) => {
      const bodyRecord: unknown = req.body;
      if (req.method === 'POST' && isRecord(bodyRecord) && !('json' in bodyRecord)) {
        req.body = { json: bodyRecord };
      }
      next();
    });

    app.use(
      rootPath,
      createExpressMiddleware({
        createContext: ({
          req,
          res,
        }: {
          req: ExpressRequest;
          res: ExpressResponse;
        }): ServiceContext => {
          assertIsCustomRequest(req);
          assertIsCustomResponse(res);
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
