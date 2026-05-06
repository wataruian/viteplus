import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import { DefaultService } from '../../../services/default';
import { createRouteHandler } from '../../../utils/route-handler';
import { publicProcedure, router } from '../../../utils/trpc';

const defaultRouter = router({
  root: publicProcedure.query(createRouteHandler(DefaultService, 'root')),
});

export type DefaultRouter = typeof defaultRouter;
export type DefaultRouterInput = inferRouterInputs<DefaultRouter>;
export type DefaultRouterOutput = inferRouterOutputs<DefaultRouter>;

export default defaultRouter;
