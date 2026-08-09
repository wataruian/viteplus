import {
  TestService,
  TestServiceInputSchemas,
  TestServiceOutputSchemas,
} from '../../../services/test';
import { createBaseResponseSchema, createRouteHandler } from '../../../utils/route-handler';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { publicProcedure, router } from '../../../utils/trpc';

const testRouter = router({
  asyncFailReject: publicProcedure
    .input(TestServiceInputSchemas.asyncFailReject)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.asyncFailReject))
    .query(createRouteHandler(TestService, 'asyncFailReject')),
  asyncFailThrow: publicProcedure
    .input(TestServiceInputSchemas.asyncFailThrow)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.asyncFailThrow))
    .query(createRouteHandler(TestService, 'asyncFailThrow')),
  asyncSuccess: publicProcedure
    .input(TestServiceInputSchemas.asyncSuccess)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.asyncSuccess))
    .query(createRouteHandler(TestService, 'asyncSuccess')),
  checkParams: publicProcedure
    .input(TestServiceInputSchemas.checkParams)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.checkParams))
    .mutation(createRouteHandler(TestService, 'checkParams')),
  customTypeArray: publicProcedure
    .input(TestServiceInputSchemas.customTypeArray)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.customTypeArray))
    .mutation(createRouteHandler(TestService, 'customTypeArray')),
  customTypeSingle: publicProcedure
    .input(TestServiceInputSchemas.customTypeSingle)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.customTypeSingle))
    .mutation(createRouteHandler(TestService, 'customTypeSingle')),
  getWithParam: publicProcedure
    .input(TestServiceInputSchemas.getWithParam)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.getWithParam))
    .query(createRouteHandler(TestService, 'getWithParam')),
  hello: publicProcedure
    .input(TestServiceInputSchemas.hello)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.hello))
    .mutation(createRouteHandler(TestService, 'hello')),
  mixedParams: publicProcedure
    .input(TestServiceInputSchemas.mixedParams)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.mixedParams))
    .mutation(createRouteHandler(TestService, 'mixedParams')),
  objectDestructured: publicProcedure
    .input(TestServiceInputSchemas.objectDestructured)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.objectDestructured))
    .mutation(createRouteHandler(TestService, 'objectDestructured')),
  objectOnly: publicProcedure
    .input(TestServiceInputSchemas.objectOnly)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.objectOnly))
    .mutation(createRouteHandler(TestService, 'objectOnly')),
  primitivesAndArray: publicProcedure
    .input(TestServiceInputSchemas.primitivesAndArray)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.primitivesAndArray))
    .mutation(createRouteHandler(TestService, 'primitivesAndArray')),
  syncFailReject: publicProcedure
    .input(TestServiceInputSchemas.syncFailReject)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.syncFailReject))
    .query(createRouteHandler(TestService, 'syncFailReject')),
  syncFailThrow: publicProcedure
    .input(TestServiceInputSchemas.syncFailThrow)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.syncFailThrow))
    .query(createRouteHandler(TestService, 'syncFailThrow')),
  syncSuccess: publicProcedure
    .input(TestServiceInputSchemas.syncSuccess)
    .output(createBaseResponseSchema(TestServiceOutputSchemas.syncSuccess))
    .query(createRouteHandler(TestService, 'syncSuccess')),
});

type TestRouter = typeof testRouter;
type TestRouterInput = inferRouterInputs<TestRouter>;
type TestRouterOutput = inferRouterOutputs<TestRouter>;

export type { TestRouter, TestRouterInput, TestRouterOutput };
export default testRouter;
