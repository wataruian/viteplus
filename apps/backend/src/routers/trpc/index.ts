import { isTest } from '@lightproject/common/environment';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import { config } from '../../config';
import { router } from '../../utils/trpc';
import defaultRoutes from './routes/default';
import testRoutes from './routes/test';

const getTrpcRouter = () => {
  const includeTestRoutes = config.enableTestRoutes || isTest();
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
