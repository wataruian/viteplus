import {
  DefaultService,
  DefaultServiceInputSchemas,
  DefaultServiceOutputSchemas,
} from '../../../services/default';
import { createBaseResponseSchema, createRouteHandler } from '../../../utils/route-handler';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { publicProcedure, router } from '../../../utils/trpc';

const defaultRouter = router({
  root: publicProcedure
    .input(DefaultServiceInputSchemas.root)
    .output(createBaseResponseSchema(DefaultServiceOutputSchemas.root))
    .query(createRouteHandler(DefaultService, 'root')),
});

type DefaultRouter = typeof defaultRouter;
type DefaultRouterInput = inferRouterInputs<DefaultRouter>;
type DefaultRouterOutput = inferRouterOutputs<DefaultRouter>;

export type { DefaultRouter, DefaultRouterInput, DefaultRouterOutput };
export default defaultRouter;
