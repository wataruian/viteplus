import type { InputArgs, ServiceContext } from '../middlewares/initialize-request';
import { BaseService } from './base';
import type { InferSchemaMap } from '../utils/autogen/utils/zod';
import { sleep } from '@lightproject/common/utils';
import z from 'zod';

const TestServiceInputSchemas = {
  asyncFailReject: z.void(),
  asyncFailThrow: z.void(),
  asyncSuccess: z.void(),
  checkParams: z.object({
    boolean: z.boolean().optional(),
    booleanArray: z.array(z.boolean()).optional(),
    number: z.number().optional(),
    numberArray: z.array(z.number()).optional(),
    objectBoolean: z.object({ boolean: z.boolean() }).nullable().optional(),
    objectBooleanArray: z
      .object({ booleanArray: z.array(z.boolean()) })
      .nullable()
      .optional(),
    objectMultiple: z
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
      .nullable()
      .optional(),
    objectNumber: z.object({ number: z.number() }).nullable().optional(),
    objectNumberArray: z
      .object({ numberArray: z.array(z.number()) })
      .nullable()
      .optional(),
    objectString: z.object({ string: z.string() }).nullable().optional(),
    objectStringArray: z
      .object({ stringArray: z.array(z.string()) })
      .nullable()
      .optional(),
    string: z.string().optional(),
    stringArray: z.array(z.string()).optional(),
  }),
  customTypeArray: z.object({
    testUsers: z
      .array(
        z.object({
          address: z.object({
            city: z.string(),
            houseNumber: z.number(),
            province: z.string(),
            street: z.string().optional(),
          }),
          age: z.number(),
          firstName: z.string(),
          lastName: z.string(),
          middleName: z.string().optional(),
        }),
      )
      .optional(),
  }),
  customTypeSingle: z.object({
    testUser: z
      .object({
        address: z.object({
          city: z.string(),
          houseNumber: z.number(),
          province: z.string(),
          street: z.string().optional(),
        }),
        age: z.number(),
        firstName: z.string(),
        lastName: z.string(),
        middleName: z.string().optional(),
      })
      .optional(),
  }),
  getWithParam: z.object({
    firstName: z.string(),
    lastName: z.string().optional(),
  }),
  hello: z.object({
    firstName: z.string(),
    lastName: z.string().optional(),
  }),
  mixedParams: z.object({
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
  objectDestructured: z.object({
    prop1: z.string(),
    prop2: z.number(),
  }),
  objectOnly: z.object({
    options: z.object({
      bar: z.number().optional(),
      foo: z.string().optional(),
    }),
  }),
  primitivesAndArray: z.object({
    var1: z.string(),
    var2: z.number(),
    var3: z.array(z.string()).optional(),
  }),
  syncFailReject: z.void(),
  syncFailThrow: z.void(),
  syncSuccess: z.void(),
};

const TestServiceOutputSchemas = {
  asyncFailReject: z.void(),
  asyncFailThrow: z.void(),
  asyncSuccess: z.object({
    customMessage: z.string(),
  }),
  checkParams: z.object({
    boolean: z.boolean(),
    booleanArray: z.array(z.boolean()),
    number: z.number(),
    numberArray: z.array(z.number()),
    objectBoolean: z.object({ boolean: z.boolean() }),
    objectBooleanArray: z.object({ booleanArray: z.array(z.boolean()) }),
    objectMultiple: z.object({
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
    }),
    objectNumber: z.object({ number: z.number() }),
    objectNumberArray: z.object({ numberArray: z.array(z.number()) }),
    objectString: z.object({ string: z.string() }),
    objectStringArray: z.object({ stringArray: z.array(z.string()) }),
    string: z.string(),
    stringArray: z.array(z.string()),
  }),
  customTypeArray: z.object({
    testUsers: z.array(
      z.object({
        address: z.object({
          city: z.string(),
          houseNumber: z.number(),
          province: z.string(),
          street: z.string().optional(),
        }),
        age: z.number(),
        firstName: z.string(),
        lastName: z.string(),
        middleName: z.string().optional(),
      }),
    ),
  }),
  customTypeSingle: z.object({
    testUser: z.object({
      address: z.object({
        city: z.string(),
        houseNumber: z.number(),
        province: z.string(),
        street: z.string().optional(),
      }),
      age: z.number(),
      firstName: z.string(),
      lastName: z.string(),
      middleName: z.string().optional(),
    }),
  }),
  getWithParam: z.object({
    customMessage: z.string(),
  }),
  hello: z.object({
    customMessage: z.string(),
  }),
  mixedParams: z.object({
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
  objectDestructured: z.object({
    prop1: z.string(),
    prop2: z.number(),
  }),
  objectOnly: z.object({
    options: z.object({
      bar: z.number(),
      foo: z.string(),
    }),
  }),
  primitivesAndArray: z.object({
    var1: z.string(),
    var2: z.number(),
    var3: z.array(z.string()),
  }),
  syncFailReject: z.void(),
  syncFailThrow: z.void(),
  syncSuccess: z.object({
    customMessage: z.string(),
  }),
};

class TestService extends BaseService {
  public constructor(ctx: ServiceContext, inputArgs: InputArgs = {}) {
    super(ctx, inputArgs);
  }

  public static checkParams(
    _input: z.infer<typeof TestServiceInputSchemas.checkParams> = {},
  ): z.infer<typeof TestServiceOutputSchemas.checkParams> {
    return {
      boolean: true,
      booleanArray: [true, false],
      number: 123,
      numberArray: [123, 456],
      objectBoolean: { boolean: true },
      objectBooleanArray: { booleanArray: [true, false] },
      objectMultiple: {
        boolean: false,
        booleanArray: [true, false],
        number: 123,
        numberArray: [123, 456],
        object: {
          boolean: true,
          booleanArray: [true, false],
          number: 123,
          numberArray: [123, 456],
          string: 'ABC',
          stringArray: ['ABC', 'DEF'],
        },
        objectArray: [
          {
            boolean: true,
            booleanArray: [true, false],
            number: 123,
            numberArray: [123, 456],
            string: 'ABC',
            stringArray: ['ABC', 'DEF'],
          },
          {
            boolean: false,
            booleanArray: [false, true],
            number: 456,
            numberArray: [456, 789],
            string: 'DEF',
            stringArray: ['DEF', 'GHI'],
          },
        ],
        string: 'ABC',
        stringArray: ['ABC', 'DEF'],
      },
      objectNumber: { number: 123 },
      objectNumberArray: {
        numberArray: [123, 456],
      },
      objectString: { string: 'ABC' },
      objectStringArray: { stringArray: ['ABC', 'DEF'] },
      string: 'ABC',
      stringArray: ['ABC', 'DEF'],
    };
  }

  public static getWithParam(
    input: z.infer<typeof TestServiceInputSchemas.getWithParam>,
  ): z.infer<typeof TestServiceOutputSchemas.getWithParam> {
    const fullName =
      input.lastName !== undefined && input.lastName !== ''
        ? `${input.firstName} ${input.lastName}`
        : input.firstName;
    return { customMessage: `Hello, ${fullName}!` };
  }

  public static async asyncFailReject(): Promise<
    z.infer<typeof TestServiceOutputSchemas.asyncFailReject>
  > {
    await Promise.resolve(sleep(0));
    throw new Error('Async error. Simulated promise rejection');
  }

  public static async asyncFailThrow(): Promise<
    z.infer<typeof TestServiceOutputSchemas.asyncFailThrow>
  > {
    await Promise.resolve(sleep(0));
    throw new Error('Async error. Simulated throwing exception');
  }

  public static async asyncSuccess(): Promise<
    z.infer<typeof TestServiceOutputSchemas.asyncSuccess>
  > {
    await Promise.resolve(sleep(0));
    return { customMessage: 'Async success' };
  }

  public static customTypeArray(
    input: z.infer<typeof TestServiceInputSchemas.customTypeArray> = {},
  ): z.infer<typeof TestServiceOutputSchemas.customTypeArray> {
    const testUsers = input.testUsers ?? [
      {
        address: {
          city: 'Sample City 1',
          houseNumber: 11,
          province: 'Sample Province 1',
          street: 'Sample Street 1',
        },
        age: 22,
        firstName: 'John',
        lastName: 'Doe',
      },
      {
        address: {
          city: 'Sample City 2',
          houseNumber: 22,
          province: 'Sample Province 2',
          street: 'Sample Street 2',
        },
        age: 22,
        firstName: 'Jane',
        lastName: 'Doe',
      },
    ];
    return {
      testUsers,
    };
  }

  public static customTypeSingle(
    input: z.infer<typeof TestServiceInputSchemas.customTypeSingle> = {},
  ): z.infer<typeof TestServiceOutputSchemas.customTypeSingle> {
    const testUser = input.testUser ?? {
      address: {
        city: 'Sample City',
        houseNumber: 11,
        province: 'Sample Province',
        street: 'Sample Street',
      },
      age: 22,
      firstName: 'John',
      lastName: 'Doe',
    };
    return {
      testUser,
    };
  }

  public static hello(
    input: z.infer<typeof TestServiceInputSchemas.hello>,
  ): z.infer<typeof TestServiceOutputSchemas.hello> {
    const fullName =
      input.lastName !== undefined && input.lastName !== ''
        ? `${input.firstName} ${input.lastName}`
        : input.firstName;
    return { customMessage: `Hello, ${fullName}!` };
  }

  public static mixedParams(
    input: z.infer<typeof TestServiceInputSchemas.mixedParams>,
  ): z.infer<typeof TestServiceOutputSchemas.mixedParams> {
    return {
      a: input.a,
      arr: input.arr,
      b: input.b,
      options: input.options,
    };
  }

  public static objectDestructured(
    input: z.infer<typeof TestServiceInputSchemas.objectDestructured>,
  ): z.infer<typeof TestServiceOutputSchemas.objectDestructured> {
    return {
      prop1: input.prop1,
      prop2: input.prop2,
    };
  }

  public static objectOnly(
    _input: z.infer<typeof TestServiceInputSchemas.objectOnly>,
  ): z.infer<typeof TestServiceOutputSchemas.objectOnly> {
    return {
      options: {
        bar: 123,
        foo: 'ABC',
      },
    };
  }

  public static primitivesAndArray(
    input: z.infer<typeof TestServiceInputSchemas.primitivesAndArray>,
  ): z.infer<typeof TestServiceOutputSchemas.primitivesAndArray> {
    return {
      var1: input.var1,
      var2: input.var2,
      var3: ['ABC', 'DEF'],
    };
  }

  public static syncFailReject(): z.infer<typeof TestServiceOutputSchemas.syncFailReject> {
    throw new Error('Sync error. Simulated promise rejection');
  }

  public static syncFailThrow(): z.infer<typeof TestServiceOutputSchemas.syncFailThrow> {
    throw new Error('Sync error. Simulated throwing exception');
  }

  public static syncSuccess(): z.infer<typeof TestServiceOutputSchemas.syncSuccess> {
    return { customMessage: 'Sync success' };
  }
}

type TestServiceInputs = InferSchemaMap<typeof TestServiceInputSchemas>;
type TestServiceOutputs = InferSchemaMap<typeof TestServiceOutputSchemas>;

export type { TestServiceInputs, TestServiceOutputs };
export { TestServiceInputSchemas, TestServiceOutputSchemas, TestService };
