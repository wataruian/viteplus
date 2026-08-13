import { getEnv, isTest, isTrue } from '@lightproject/common/environment';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import { router } from '../../utils/trpc';
import defaultRoutes from './routes/default';
import testRoutes from './routes/test';

const getTrpcRouter = () => {
  const includeTestRoutes = isTrue(getEnv('ENABLE_TEST_ROUTES')) || isTest();
  return router({
    default: defaultRoutes,
    ...(includeTestRoutes ? { test: testRoutes } : {}),
  });
};

const fullRouterForType = router({
  default: defaultRoutes,
  test: testRoutes,
});

type TrpcRouter = typeof fullRouterForType;
type TrpcRouterInput = inferRouterInputs<TrpcRouter>;
type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>;

export { getTrpcRouter };
export type { TrpcRouter, TrpcRouterInput, TrpcRouterOutput };
