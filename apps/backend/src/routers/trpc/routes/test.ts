import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { publicProcedure, router } from '../../../utils/trpc';
import { TestService } from '../../../services/test';
import { createRouteHandler } from '../../../utils/route-handler';
import z from 'zod';

const testRouter = router({
  _checkParams: publicProcedure
    .input(
      z.object({
        booleanArrayInput: z.array(z.boolean()).optional(),
        booleanInput: z.boolean().optional(),
        numberArrayInput: z.array(z.number()).optional(),
        numberInput: z.number().optional(),
        objectBooleanArrayInput: z
          .object({ booleanArray: z.array(z.boolean()) })
          .optional()
          .nullable(),
        objectBooleanInput: z.object({ boolean: z.boolean() }).optional().nullable(),
        objectMultipleInput: z
          .object({
            boolean: z.boolean(),
            booleanArray: z.array(z.boolean()),
            number: z.number(),
            numberArray: z.array(z.number()),
            object: z.object({
              boolean: z.boolean(),
              booleanArray: z.array(z.boolean()),
              number: z.number(),
              numberArray: z.array(z.number()),
              string: z.string(),
              stringArray: z.array(z.string()),
            }),
            objectArray: z.array(
              z.object({
                boolean: z.boolean(),
                booleanArray: z.array(z.boolean()),
                number: z.number(),
                numberArray: z.array(z.number()),
                string: z.string(),
                stringArray: z.array(z.string()),
              }),
            ),
            string: z.string(),
            stringArray: z.array(z.string()),
          })
          .optional()
          .nullable(),
        objectNumberArrayInput: z
          .object({ numberArray: z.array(z.number()) })
          .optional()
          .nullable(),
        objectNumberInput: z.object({ number: z.number() }).optional().nullable(),
        objectStringArrayInput: z
          .object({ stringArray: z.array(z.string()) })
          .optional()
          .nullable(),
        objectStringInput: z.object({ string: z.string() }).optional().nullable(),
        stringArrayInput: z.array(z.string()).optional(),
        stringInput: z.string().optional(),
      }),
    )
    .mutation(createRouteHandler(TestService, '_checkParams')),
  asyncFailReject: publicProcedure.query(createRouteHandler(TestService, 'asyncFailReject')),
  asyncFailThrow: publicProcedure.query(createRouteHandler(TestService, 'asyncFailThrow')),
  asyncSuccess: publicProcedure.query(createRouteHandler(TestService, 'asyncSuccess')),
  hello: publicProcedure
    .input(z.object({ firstName: z.string(), lastName: z.string().optional() }))
    .mutation(createRouteHandler(TestService, 'hello')),
  mixedParams: publicProcedure
    .input(
      z.object({
        a: z.string(),
        arr: z.array(z.number()).optional(),
        b: z.number(),
        options: z
          .object({
            bar: z.number().optional(),
            foo: z.string().optional(),
          })
          .optional(),
      }),
    )
    .mutation(createRouteHandler(TestService, 'mixedParams')),
  objectDestructured: publicProcedure
    .input(
      z.object({
        prop1: z.string().optional(),
        prop2: z.number().optional(),
      }),
    )
    .mutation(createRouteHandler(TestService, 'objectDestructured')),
  objectOnly: publicProcedure
    .input(
      z.object({
        bar: z.number().optional(),
        foo: z.string().optional(),
      }),
    )
    .mutation(createRouteHandler(TestService, 'objectOnly')),
  primitivesAndArray: publicProcedure
    .input(
      z.object({
        var1: z.string(),
        var2: z.number(),
        var3: z.array(z.string()).optional(),
      }),
    )
    .mutation(createRouteHandler(TestService, 'primitivesAndArray')),
  syncFailReject: publicProcedure.query(createRouteHandler(TestService, 'syncFailReject')),
  syncFailThrow: publicProcedure.query(createRouteHandler(TestService, 'syncFailThrow')),
  syncSuccess: publicProcedure.query(createRouteHandler(TestService, 'syncSuccess')),
});

type TestRouter = typeof testRouter;
type TestRouterInput = inferRouterInputs<TestRouter>;
type TestRouterOutput = inferRouterOutputs<TestRouter>;

export type { TestRouter, TestRouterInput, TestRouterOutput };
export default testRouter;
