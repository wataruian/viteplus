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

export { publicHttp };
