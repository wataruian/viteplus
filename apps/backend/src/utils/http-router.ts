import type {
  ExpressRequest,
  ExpressResponse,
  HttpMethod,
  InputArgs,
  Request,
  Response,
  ServiceContext,
} from '../types/middlware';
import { endpoints } from '@lightproject/common/configs';
import { logger } from '@lightproject/common/logger';
import type { Express } from 'express';
import { httpRouter } from '../routers/http';

const DEFAULT_SUCCESS_STATUS_CODE = 200;

const TRAILING_SLASHES = /\/+$/;
const LEADING_SLASHES = /^\/+/;

const joinPaths = (a: string, b: string) =>
  `${a.replace(TRAILING_SLASHES, '')}/${b.replace(LEADING_SLASHES, '')}`.replace(
    TRAILING_SLASHES,
    '',
  ) || '/';

export const registerHttpRoutes = (
  app: Express,
  rootPath: string = endpoints.apiEndpoint,
): void => {
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
                ctx.res.status(response.code || DEFAULT_SUCCESS_STATUS_CODE).json(response);
              }
            }
          });
        }
      }
    }
  } catch (error) {
    logger.error('Failed to register HTTP routes:', error);
    throw error;
  }
};
