import type { RouteHandler } from '../types/middlware';

const publicHttp = {
  delete: (handlerFactory: () => RouteHandler) => ({
    handler: handlerFactory(),
    method: 'delete',
  }),
  get: (handlerFactory: () => RouteHandler) => ({
    handler: handlerFactory(),
    method: 'get',
  }),
  options: (handlerFactory: () => RouteHandler) => ({
    handler: handlerFactory(),
    method: 'options',
  }),
  patch: (handlerFactory: () => RouteHandler) => ({
    handler: handlerFactory(),
    method: 'patch',
  }),
  post: (handlerFactory: () => RouteHandler) => ({
    handler: handlerFactory(),
    method: 'post',
  }),
  put: (handlerFactory: () => RouteHandler) => ({
    handler: handlerFactory(),
    method: 'put',
  }),
};

export { publicHttp };
