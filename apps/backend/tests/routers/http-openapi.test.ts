import { expect, test } from 'vite-plus/test';

import { apiRouter } from '../../src/routers/http';
import {
  assertHttpRoutesDocumented,
  createHttpRouter,
  defineHttpRoute,
} from '../../src/routers/utils';
import { DefaultService } from '../../src/services/default';

test('every registered HTTP route is discoverable for OpenAPI generation', () => {
  expect(() => {
    assertHttpRoutesDocumented(apiRouter);
  }).not.toThrow();
});

test('a route registered without going through defineHttpRoute throws instead of silently vanishing from the docs', () => {
  const router = createHttpRouter([
    defineHttpRoute({
      handlerFn: DefaultService.root,
      method: 'get',
      path: '/root',
    }),
  ]);

  router.get('/broken', (c) => c.json({ ok: true }));

  expect(() => {
    assertHttpRoutesDocumented(router);
  }).toThrow(/\/broken/u);
});
