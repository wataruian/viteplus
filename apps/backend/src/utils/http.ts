import type { HttpMethod, RouteHandler, ServiceContext } from '../types/middlware';

const publicHttp = {
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

const makeHttp = (method: HttpMethod) => (handlerFactory: () => RouteHandler) => ({
  handler: async (ctx: ServiceContext) => {
    try {
      const input = ctx.req.body || ctx.req.query || ctx.req.params || {};
      const handler = handlerFactory();
      const result = await Promise.resolve(handler({ ctx, input }));
      ctx.res.status(result?.code || 200).json(result);
    } catch (error) {
      ctx.res.status(500).json({
        code: 500,
        error: String(error),
        message: 'Internal Server Error',
      });
    }
  },
  method,
});

export { publicHttp, makeHttp };
