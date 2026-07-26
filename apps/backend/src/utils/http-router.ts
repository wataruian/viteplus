import {
  type ExpressRequest,
  type ExpressResponse,
  type ServiceContext,
  assertIsCustomRequest,
  assertIsCustomResponse,
  isBaseResponse,
  isHttpMethod,
} from '../types/middlware';
import type { Express } from 'express';
import { apiEndpoint } from '@lightproject/common/configs';
import { httpRouter } from '../routers/http';
import { isCallable } from '@lightproject/common/validators';
import { logger } from '@lightproject/common/logger';

const joinPaths = (a: string, b: string) =>
  `${a.replace(/\/+$/u, '')}/${b.replace(/^\/+/u, '')}`.replace(/\/+$/u, '') || '/';

const registerHttpRoutes = (app: Express, rootPath: string = apiEndpoint): void => {
  try {
    for (const route of httpRouter) {
      for (const [path, { handler, method }] of Object.entries(route)) {
        const methodLower = method.toLowerCase();
        if (!isHttpMethod(methodLower)) {
          continue;
        }
        const httpMethod = methodLower;
        const fullPath = joinPaths(rootPath, path);

        for (const routePath of [fullPath, `${fullPath}/`]) {
          app[httpMethod](routePath, async (req: ExpressRequest, res: ExpressResponse) => {
            assertIsCustomRequest(req);
            assertIsCustomResponse(res);
            const ctx: ServiceContext = {
              req,
              res,
            };
            const inputRaw: unknown = req.body ?? req.query ?? req.params ?? {};
            if (isCallable(handler)) {
              const responseRaw = await Promise.resolve(handler({ ctx, input: inputRaw }));
              if (isBaseResponse(responseRaw) && !res.headersSent) {
                ctx.res.status(responseRaw.code ?? 200).json(responseRaw);
              }
            }
          });
        }
      }
    }
  } catch (error) {
    logger.error(
      'Failed to register HTTP routes:',
      error instanceof Error ? { message: error.message, stack: error.stack } : { error },
    );
    throw error;
  }
};

export { registerHttpRoutes };
