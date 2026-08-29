import { expect, test } from 'vite-plus/test';

import { appRouter } from '../../src/routers/trpc';
import { collectTrpcOpenApiRoutes, createQuery, defineTrpcRoute, t } from '../../src/routers/utils';
import { DefaultService } from '../../src/services/default';

test('every registered tRPC procedure is discoverable for OpenAPI generation', () => {
  const openApiRoutes = collectTrpcOpenApiRoutes(appRouter);
  const registeredProcedureCount = Object.keys(appRouter._def.procedures).length;

  expect(openApiRoutes).toHaveLength(registeredProcedureCount);
});

test('a procedure built without route metadata throws instead of silently vanishing from the docs', () => {
  const mixedRouter = t.router({
    broken: t.procedure.query(() => ({ ok: true })),
    root: createQuery(
      defineTrpcRoute({
        handlerFn: DefaultService.root,
        inputOptional: true,
        method: 'get',
        path: '/default.root',
      }),
    ),
  });

  expect(() => collectTrpcOpenApiRoutes(mixedRouter)).toThrow(/broken/u);
});
