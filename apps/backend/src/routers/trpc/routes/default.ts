import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { publicProcedure, router } from '../../../utils/trpc';
import { DefaultService } from '../../../services/default';
import { createRouteHandler } from '../../../utils/route-handler';

const defaultRouter = router({
  root: publicProcedure.query(createRouteHandler(DefaultService, 'root')),
});

type DefaultRouter = typeof defaultRouter;
type DefaultRouterInput = inferRouterInputs<DefaultRouter>;
type DefaultRouterOutput = inferRouterOutputs<DefaultRouter>;

export type { DefaultRouter, DefaultRouterInput, DefaultRouterOutput };
export default defaultRouter;
