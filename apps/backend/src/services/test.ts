import type { InputArgs, ServiceContext } from '../types/middlware';
import { BaseService } from './base';
import { sleep } from '@lightproject/common/utils';

class TestService extends BaseService {
  public constructor(ctx: ServiceContext, inputArgs: InputArgs = {}) {
    super(ctx, inputArgs);
  }

  public static _checkParams(
    _stringInput = 'ABC',
    _stringArrayInput: string[] = ['ABC', 'DEF'],
    _numberInput = 123,
    _numberArrayInput: number[] = [123, 456],
    _booleanInput = true,
    _booleanArrayInput: boolean[] = [true, false],
    _objectStringInput: { string: string } = { string: 'ABC' },
    _objectStringArrayInput: { stringArray: string[] } = {
      stringArray: ['ABC', 'DEF'],
    },
    _objectNumberInput: { number: number } = { number: 123 },
    _objectNumberArrayInput: { numberArray: number[] } = {
      numberArray: [123, 456],
    },
    _objectBooleanInput: { boolean: boolean } = { boolean: true },
    _objectBooleanArrayInput: { booleanArray: boolean[] } = {
      booleanArray: [true, false],
    },
    _objectMultipleInput: {
      boolean: boolean;
      booleanArray: boolean[];
      number: number;
      numberArray: number[];
      object: {
        boolean: boolean;
        booleanArray: boolean[];
        number: number;
        numberArray: number[];
        string: string;
        stringArray: string[];
      };
      objectArray: {
        boolean: boolean;
        booleanArray: boolean[];
        number: number;
        numberArray: number[];
        string: string;
        stringArray: string[];
      }[];
      string: string;
      stringArray: string[];
    } = {
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
    _string = 'ABC',
    _stringArray: string[] = ['ABC', 'DEF'],
  ) {
    return {
      booleanArrayOutput: [true, false],
      booleanOutput: true,
      numberArrayOutput: [123, 456],
      numberOutput: 123,
      objectBooleanArrayOutput: { booleanArray: [true, false] },
      objectBooleanOutput: { boolean: true },
      objectMultipleOutput: {
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
      objectNumberArrayOutput: {
        numberArray: [123, 456],
      },
      objectNumberOutput: { number: 123 },
      objectStringArrayOutput: { stringArray: ['ABC', 'DEF'] },
      objectStringOutput: { string: 'ABC' },
      stringArrayOutput: ['ABC', 'DEF'],
      stringOutput: 'ABC',
    };
  }

  public static async asyncFailReject() {
    await Promise.resolve(sleep(0));
    throw new Error('Async error. Simulated promise rejection');
  }

  public static async asyncFailThrow() {
    await Promise.resolve(sleep(0));
    throw new Error('Async error. Simulated throwing exception');
  }

  public static async asyncSuccess() {
    await Promise.resolve(sleep(0));
    return { message: 'Async success' };
  }

  public static hello(firstName: string, lastName?: string) {
    const fullName =
      lastName !== undefined && lastName !== '' ? `${firstName} ${lastName}` : firstName;
    return { message: `Hello, ${fullName}!` };
  }

  public static mixedParams(
    a: string,
    b: number,
    options?: { bar?: number; foo?: string },
    arr?: number[],
  ) {
    return {
      data: { a, arr, b, options },
      message: 'Mixed parameters processed successfully',
    };
  }

  public static objectDestructured({ prop1, prop2 }: { prop1?: string; prop2?: number }) {
    return {
      data: { prop1, prop2 },
      message: 'Object destructured parameters processed successfully',
    };
  }

  public static objectOnly(options: { bar?: number; foo?: string }) {
    return {
      data: options,
      message: 'Object parameters processed successfully',
    };
  }

  public static primitivesAndArray(var1: string, var2: number, var3?: string[]) {
    return {
      data: {
        var1,
        var2,
        var3,
      },
      message: 'Primitives and array processed successfully',
    };
  }

  public static syncFailReject() {
    throw new Error('Sync error. Simulated promise rejection');
  }

  public static syncFailThrow() {
    throw new Error('Sync error. Simulated throwing exception');
  }

  public static syncSuccess() {
    return { message: 'Sync success' };
  }
}

export { TestService };
