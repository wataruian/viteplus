import type {
  ExpressRequest,
  ExpressResponse,
  HttpMethod,
  InputArgs,
  Request,
  Response,
  ServiceContext,
} from '../types/middlware';
import type { Express } from 'express';
import { apiEndpoint } from '@lightproject/common/configs';
import { httpRouter } from '../routers/http';
import { logger } from '@lightproject/common/logger';

const joinPaths = (a: string, b: string) =>
  `${a.replace(/\/+$/, '')}/${b.replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/';

const registerHttpRoutes = (app: Express, rootPath: string = apiEndpoint): void => {
  try {
    for (const route of httpRouter) {
      for (const [path, { handler, method }] of Object.entries(route)) {
        const httpMethod = method.toLowerCase() as HttpMethod;
        const fullPath = joinPaths(rootPath, path);

        for (const routePath of [fullPath, `${fullPath}/`]) {
          app[httpMethod](routePath, async (req: ExpressRequest, res: ExpressResponse) => {
            const ctx: ServiceContext = {
              req: req as Request,
              res: res as Response,
            };
            const input: InputArgs = req.body || req.query || req.params || {};
            if (typeof handler === 'function') {
              const response = await Promise.resolve(handler({ ctx, input }));
              if (!res.headersSent) {
                ctx.res.status(response.code || 200).json(response);
              }
            }
          });
        }
      }
    }
  } catch (error) {
    logger.error('Failed to register HTTP routes:', error as Record<string, unknown>);
    throw error;
  }
};

export { registerHttpRoutes };
