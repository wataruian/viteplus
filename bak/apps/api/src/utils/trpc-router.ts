import { endpoints } from '@lightproject/common/configs';
import { logger } from '@lightproject/common/logger';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import type { Express } from 'express';
import { type TrpcRouter, trpcRouter } from '../routers/trpc';
import type {
  ExpressRequest,
  ExpressResponse,
  Request,
  Response,
  ServiceContext,
} from '../types/middlware';
import { createContext, transformer } from './trpc';

export const createCaller = (ctx: ServiceContext) => {
  return trpcRouter.createCaller(ctx);
};

export const trpcClient = createTRPCClient<TrpcRouter>({
  links: [
    httpBatchLink({
      transformer,
      url: endpoints.trpcUrl,
    }),
  ],
});

export const registerTrpcRoutes = (
  app: Express,
  rootPath: string = endpoints.trpcEndpoint
) => {
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
        }): ServiceContext => {
          return createContext(req as Request, res as Response);
        },
        router: trpcRouter,
      })
    );
  } catch (error) {
    logger.error('Failed to register tRPC routes:', error);
    throw error;
  }
};

export type AppRouterCaller = ReturnType<typeof createCaller>;
export type AppRouterPaths = TrpcRouterPaths<AppRouterCaller>;
export type TrpcRouterPaths<T> = T extends object
  ? {
      // biome-ignore lint/suspicious/noExplicitAny: ignore
      [K in keyof T]: T[K] extends (...args: any[]) => any
        ? K
        : T[K] extends object
          ? K extends string
            ? `${K}.${string & TrpcRouterPaths<T[K]>}`
            : never
          : K;
    }[keyof T]
  : never;
