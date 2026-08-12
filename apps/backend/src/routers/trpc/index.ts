import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import { router } from '../../utils/trpc';
import { includeTestRoutes } from '../http';
import defaultRoutes from './routes/default';
import testRoutes from './routes/test';

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

export { trpcRouter };
export type { TrpcRouter, TrpcRouterInput, TrpcRouterOutput };
