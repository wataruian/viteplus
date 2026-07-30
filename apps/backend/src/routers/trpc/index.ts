import { getEnv, isTest } from '@lightproject/common/environment';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import defaultRoutes from './routes/default';
import { router } from '../../utils/trpc';
import testRoutes from './routes/test';

const includeTestRoutes =
  getEnv('ENABLE_TEST_ROUTES') === 'true' ||
  isTest() ||
  getEnv('VITEST') === 'true' ||
  getEnv('NODE_ENV') === 'test';

const trpcRouter = router({
  default: defaultRoutes,
  ...(includeTestRoutes ? { test: testRoutes } : {}),
});

const fullRouterForType = router({
  default: defaultRoutes,
  test: testRoutes,
});

type TrpcRouter = typeof fullRouterForType;
type TrpcRouterInput = inferRouterInputs<TrpcRouter>;
type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>;

export type { TrpcRouter, TrpcRouterInput, TrpcRouterOutput };
export { trpcRouter };
