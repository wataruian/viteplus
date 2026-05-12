import type {
  ExpressRequest,
  ExpressResponse,
  Request,
  Response,
  ServiceContext,
} from '../types/middlware';
import { type TrpcRouter, trpcRouter } from '../routers/trpc';
import { createContext, transformer } from './trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { trpcEndpoint, trpcUrl } from '@lightproject/common/configs';
import type { Express } from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
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
    app.use(
      rootPath,
      createExpressMiddleware({
        createContext: ({
          req,
          res,
        }: {
          req: ExpressRequest;
          res: ExpressResponse;
        }): ServiceContext => createContext(req as Request, res as Response),
        router: trpcRouter,
      }),
    );
  } catch (error) {
    logger.error('Failed to register tRPC routes:', error as Record<string, unknown>);
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
