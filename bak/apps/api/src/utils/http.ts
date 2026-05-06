import type {
  HttpMethod,
  RouteHandler,
  ServiceContext,
} from '../types/middlware';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

export const publicHttp = {
  delete: (handlerFactory: () => unknown) => ({
    handler: handlerFactory(),
    method: 'delete',
  }),
  get: (handlerFactory: () => unknown) => ({
    handler: handlerFactory(),
    method: 'get',
  }),
  options: (handlerFactory: () => unknown) => ({
    handler: handlerFactory(),
    method: 'options',
  }),
  patch: (handlerFactory: () => unknown) => ({
    handler: handlerFactory(),
    method: 'patch',
  }),
  post: (handlerFactory: () => unknown) => ({
    handler: handlerFactory(),
    method: 'post',
  }),
  put: (handlerFactory: () => unknown) => ({
    handler: handlerFactory(),
    method: 'put',
  }),
};

export const makeHttp = (method: HttpMethod) => {
  return (handlerFactory: () => RouteHandler) => ({
    handler: async (ctx: ServiceContext) => {
      try {
        const input = ctx.req.body || ctx.req.query || ctx.req.params || {};
        const handler = handlerFactory();
        const result = await Promise.resolve(handler({ ctx, input }));
        ctx.res.status(result?.code || HTTP_STATUS_OK).json(result);
      } catch (error) {
        ctx.res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
          code: HTTP_STATUS_INTERNAL_SERVER_ERROR,
          error: String(error),
          message: 'Internal Server Error',
        });
      }
    },
    method,
  });
};
