import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import { router } from '../../utils/trpc';
import defaultRoutes from './routes/default';
import testRoutes from './routes/test';

export const trpcRouter = router({
  default: defaultRoutes,
  test: testRoutes,
});

export type TrpcRouter = typeof trpcRouter;
export type TrpcRouterInput = inferRouterInputs<TrpcRouter>;
export type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>;
