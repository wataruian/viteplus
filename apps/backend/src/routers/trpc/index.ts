import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import defaultRoutes from './routes/default';
import { router } from '../../utils/trpc';
import testRoutes from './routes/test';

const trpcRouter = router({
  default: defaultRoutes,
  test: testRoutes,
});

type TrpcRouter = typeof trpcRouter;
type TrpcRouterInput = inferRouterInputs<TrpcRouter>;
type TrpcRouterOutput = inferRouterOutputs<TrpcRouter>;

export type { TrpcRouter, TrpcRouterInput, TrpcRouterOutput };
export { trpcRouter };
