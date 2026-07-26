import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { publicProcedure, router } from '../../../utils/trpc';
import { TestService } from '../../../services/test';
import { createRouteHandler } from '../../../utils/route-handler';
import z from 'zod';

const objectBooleanArrayInputSchema = z.object({ booleanArray: z.array(z.boolean()) });
const objectBooleanInputSchema = z.object({ boolean: z.boolean() });
const objectNumberArrayInputSchema = z.object({ numberArray: z.array(z.number()) });
const objectNumberInputSchema = z.object({ number: z.number() });
const objectStringArrayInputSchema = z.object({ stringArray: z.array(z.string()) });
const objectStringInputSchema = z.object({ string: z.string() });

const innerObjectSchema = z.object({
  boolean: z.boolean(),
  booleanArray: z.array(z.boolean()),
  number: z.number(),
  numberArray: z.array(z.number()),
  string: z.string(),
  stringArray: z.array(z.string()),
});

const multipleInputSchema = z.object({
  boolean: z.boolean(),
  booleanArray: z.array(z.boolean()),
  number: z.number(),
  numberArray: z.array(z.number()),
  object: innerObjectSchema,
  objectArray: z.array(innerObjectSchema),
  string: z.string(),
  stringArray: z.array(z.string()),
});

const checkParamsSchema = z.object({
  booleanArrayInput: z.array(z.boolean()).optional(),
  booleanInput: z.boolean().optional(),
  numberArrayInput: z.array(z.number()).optional(),
  numberInput: z.number().optional(),
  objectBooleanArrayInput: objectBooleanArrayInputSchema.optional().nullable(),
  objectBooleanInput: objectBooleanInputSchema.optional().nullable(),
  objectMultipleInput: multipleInputSchema.optional().nullable(),
  objectNumberArrayInput: objectNumberArrayInputSchema.optional().nullable(),
  objectNumberInput: objectNumberInputSchema.optional().nullable(),
  objectStringArrayInput: objectStringArrayInputSchema.optional().nullable(),
  objectStringInput: objectStringInputSchema.optional().nullable(),
  stringArrayInput: z.array(z.string()).optional(),
  stringInput: z.string().optional(),
});

const helloSchema = z.object({ firstName: z.string(), lastName: z.string().optional() });

const mixedParamsOptionsSchema = z.object({
  bar: z.number().optional(),
  foo: z.string().optional(),
});

const mixedParamsSchema = z.object({
  a: z.string(),
  arr: z.array(z.number()).optional(),
  b: z.number(),
  options: mixedParamsOptionsSchema.optional(),
});

const objectDestructuredSchema = z.object({
  prop1: z.string().optional(),
  prop2: z.number().optional(),
});

const objectOnlySchema = z.object({
  bar: z.number().optional(),
  foo: z.string().optional(),
});

const primitivesAndArraySchema = z.object({
  var1: z.string(),
  var2: z.number(),
  var3: z.array(z.string()).optional(),
});

const addressSchema = z.object({
  city: z.string(),
  houseNumber: z.number(),
  province: z.string(),
  street: z.string().optional(),
});

const testUserSchema = z.object({
  address: addressSchema,
  age: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().optional(),
});

const customTypeArraySchema = z.object({
  testUsers: z.array(testUserSchema),
});

const customTypeSingleSchema = z.object({
  testUser: testUserSchema,
});

const testRouter = router({
  _checkParams: publicProcedure
    .input(checkParamsSchema)
    .mutation(createRouteHandler(TestService, '_checkParams')),
  asyncFailReject: publicProcedure.query(createRouteHandler(TestService, 'asyncFailReject')),
  asyncFailThrow: publicProcedure.query(createRouteHandler(TestService, 'asyncFailThrow')),
  asyncSuccess: publicProcedure.query(createRouteHandler(TestService, 'asyncSuccess')),
  customTypeArray: publicProcedure
    .input(customTypeArraySchema)
    .mutation(createRouteHandler(TestService, 'customTypeArray')),
  customTypeSingle: publicProcedure
    .input(customTypeSingleSchema)
    .mutation(createRouteHandler(TestService, 'customTypeSingle')),
  hello: publicProcedure.input(helloSchema).mutation(createRouteHandler(TestService, 'hello')),
  mixedParams: publicProcedure
    .input(mixedParamsSchema)
    .mutation(createRouteHandler(TestService, 'mixedParams')),
  objectDestructured: publicProcedure
    .input(objectDestructuredSchema)
    .mutation(createRouteHandler(TestService, 'objectDestructured')),
  objectOnly: publicProcedure
    .input(objectOnlySchema)
    .mutation(createRouteHandler(TestService, 'objectOnly')),
  primitivesAndArray: publicProcedure
    .input(primitivesAndArraySchema)
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
