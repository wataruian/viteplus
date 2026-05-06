import { time } from '@lightproject/common/utils';

import type { InputArgs, ServiceContext } from '../types/middlware';

import { BaseService } from './base';

// Test constants for default parameter values
const DEFAULT_NUMBER_VALUE = 123;
const DEFAULT_SECONDARY_NUMBER_VALUE = 456;
const DEFAULT_TERTIARY_NUMBER_VALUE = 789;

class TestService extends BaseService {
  constructor(ctx: ServiceContext, inputArgs: InputArgs = {}) {
    super(ctx, inputArgs);
  }

  _checkParams(
    _stringInput = 'ABC',
    _stringArrayInput: string[] = ['ABC', 'DEF'],
    _numberInput = DEFAULT_NUMBER_VALUE,
    _numberArrayInput: number[] = [
      DEFAULT_NUMBER_VALUE,
      DEFAULT_SECONDARY_NUMBER_VALUE,
    ],
    _booleanInput = true,
    _booleanArrayInput: boolean[] = [true, false],
    _objectStringInput: { string: string } = { string: 'ABC' },
    _objectStringArrayInput: { stringArray: string[] } = {
      stringArray: ['ABC', 'DEF'],
    },
    _objectNumberInput: { number: number } = { number: DEFAULT_NUMBER_VALUE },
    _objectNumberArrayInput: { numberArray: number[] } = {
      numberArray: [DEFAULT_NUMBER_VALUE, DEFAULT_SECONDARY_NUMBER_VALUE],
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
      number: DEFAULT_NUMBER_VALUE,
      numberArray: [DEFAULT_NUMBER_VALUE, DEFAULT_SECONDARY_NUMBER_VALUE],
      object: {
        boolean: true,
        booleanArray: [true, false],
        number: DEFAULT_NUMBER_VALUE,
        numberArray: [DEFAULT_NUMBER_VALUE, DEFAULT_SECONDARY_NUMBER_VALUE],
        string: 'ABC',
        stringArray: ['ABC', 'DEF'],
      },
      objectArray: [
        {
          boolean: true,
          booleanArray: [true, false],
          number: DEFAULT_NUMBER_VALUE,
          numberArray: [DEFAULT_NUMBER_VALUE, DEFAULT_SECONDARY_NUMBER_VALUE],
          string: 'ABC',
          stringArray: ['ABC', 'DEF'],
        },
        {
          boolean: false,
          booleanArray: [false, true],
          number: DEFAULT_SECONDARY_NUMBER_VALUE,
          numberArray: [
            DEFAULT_SECONDARY_NUMBER_VALUE,
            DEFAULT_TERTIARY_NUMBER_VALUE,
          ],
          string: 'DEF',
          stringArray: ['DEF', 'GHI'],
        },
      ],
      string: 'ABC',
      stringArray: ['ABC', 'DEF'],
    },
    _string = 'ABC',
    _stringArray: string[] = ['ABC', 'DEF']
  ) {
    return {
      booleanArrayOutput: [true, false],
      booleanOutput: true,
      numberArrayOutput: [DEFAULT_NUMBER_VALUE, DEFAULT_SECONDARY_NUMBER_VALUE],
      numberOutput: DEFAULT_NUMBER_VALUE,
      objectBooleanArrayOutput: { booleanArray: [true, false] },
      objectBooleanOutput: { boolean: true },
      objectMultipleOutput: {
        boolean: false,
        booleanArray: [true, false],
        number: DEFAULT_NUMBER_VALUE,
        numberArray: [DEFAULT_NUMBER_VALUE, DEFAULT_SECONDARY_NUMBER_VALUE],
        object: {
          boolean: true,
          booleanArray: [true, false],
          number: DEFAULT_NUMBER_VALUE,
          numberArray: [DEFAULT_NUMBER_VALUE, DEFAULT_SECONDARY_NUMBER_VALUE],
          string: 'ABC',
          stringArray: ['ABC', 'DEF'],
        },
        objectArray: [
          {
            boolean: true,
            booleanArray: [true, false],
            number: DEFAULT_NUMBER_VALUE,
            numberArray: [DEFAULT_NUMBER_VALUE, DEFAULT_SECONDARY_NUMBER_VALUE],
            string: 'ABC',
            stringArray: ['ABC', 'DEF'],
          },
          {
            boolean: false,
            booleanArray: [false, true],
            number: DEFAULT_SECONDARY_NUMBER_VALUE,
            numberArray: [
              DEFAULT_SECONDARY_NUMBER_VALUE,
              DEFAULT_TERTIARY_NUMBER_VALUE,
            ],
            string: 'DEF',
            stringArray: ['DEF', 'GHI'],
          },
        ],
        string: 'ABC',
        stringArray: ['ABC', 'DEF'],
      },
      objectNumberArrayOutput: {
        numberArray: [DEFAULT_NUMBER_VALUE, DEFAULT_SECONDARY_NUMBER_VALUE],
      },
      objectNumberOutput: { number: DEFAULT_NUMBER_VALUE },
      objectStringArrayOutput: { stringArray: ['ABC', 'DEF'] },
      objectStringOutput: { string: 'ABC' },
      stringArrayOutput: ['ABC', 'DEF'],
      stringOutput: 'ABC',
    };
  }

  async asyncFailReject() {
    const SleepDuration = 0;
    await Promise.resolve(time.sleep(SleepDuration));
    throw new Error('Async error. Simulated promise rejection');
  }

  async asyncFailThrow() {
    const SleepDuration = 0;
    await Promise.resolve(time.sleep(SleepDuration));
    throw new Error('Async error. Simulated throwing exception');
  }

  async asyncSuccess() {
    const SleepDuration = 0;
    await Promise.resolve(time.sleep(SleepDuration));
    return { message: 'Async success' };
  }

  hello(firstName: string, lastName?: string) {
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;
    return { message: `Hello, ${fullName}!` };
  }

  mixedParams(
    a: string,
    b: number,
    options?: { bar?: number; foo?: string },
    arr?: number[]
  ) {
    return {
      data: { a, arr, b, options },
      message: 'Mixed parameters processed successfully',
    };
  }

  objectDestructured({ prop1, prop2 }: { prop1?: string; prop2?: number }) {
    return {
      data: { prop1, prop2 },
      message: 'Object destructured parameters processed successfully',
    };
  }

  objectOnly(options: { bar?: number; foo?: string }) {
    return {
      data: options,
      message: 'Object parameters processed successfully',
    };
  }

  primitivesAndArray(var1: string, var2: number, var3?: string[]) {
    return {
      data: {
        var1,
        var2,
        var3,
      },
      message: 'Primitives and array processed successfully',
    };
  }

  syncFailReject() {
    throw new Error('Sync error. Simulated promise rejection');
  }

  syncFailThrow() {
    throw new Error('Sync error. Simulated throwing exception');
  }

  syncSuccess() {
    return { message: 'Sync success' };
  }
}

export { TestService };
