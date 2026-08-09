import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import defaultRoutes from './routes/default';
import { includeTestRoutes } from '../http';
import { router } from '../../utils/trpc';
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

export type { TrpcRouter, TrpcRouterInput, TrpcRouterOutput };
export { trpcRouter };
