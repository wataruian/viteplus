import type { BaseResponse } from '../types/middlware';
import type { Express } from 'express';
import { apiEndpoint } from '@lightproject/common/configs';
import { httpRouter } from '../routers/http';
import { logger } from '@lightproject/common/logger';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);

const isHttpMethod = (
  val: unknown,
): val is 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head' =>
  typeof val === 'string' && HTTP_METHODS.has(val.toLowerCase());

const joinPaths = (a: string, b: string) =>
  `${a.replace(/\/+$/u, '')}/${b.replace(/^\/+/u, '')}`.replace(/\/+$/u, '') || '/';

const isServiceHandler = (
  val: unknown,
): val is (args: { ctx: unknown; input: unknown }) => Promise<BaseResponse> | BaseResponse =>
  typeof val === 'function';

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
          app[httpMethod](routePath, async (req, res) => {
            const ctx = {
              req,
              res,
            };

            const inputRaw: unknown = req.body ?? req.query ?? req.params ?? {};

            if (isServiceHandler(handler)) {
              const responseRaw = await Promise.resolve(handler({ ctx, input: inputRaw }));

              if (!res.headersSent) {
                ctx.res.status(responseRaw.code).json(responseRaw);
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

export { HTTP_METHODS, isServiceHandler, isHttpMethod, joinPaths, registerHttpRoutes };
