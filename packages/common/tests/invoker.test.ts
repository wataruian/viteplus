import { describe, expect, it } from 'vite-plus/test';
import {
  extractParamNamesAndDefaults,
  invokeWithParsedArgs,
  normalizeArgs,
} from '../src/utils/invoker';

const testNumber = 42;
const testVar2Number = 7;
const testArrayFirst = 9;
const testArraySecond = 8;

const noParams = () => 'noParams';

const primitivesAndArray = (var1: string, var2: number, var3?: string[]) => [var1, var2, var3];

const objectOnly = (options: { bar?: number; foo?: string }) => [options];

const objectDestructured = ({ prop1, prop2 }: { prop1?: string; prop2?: number }) => [
  { prop1, prop2 },
];

const mixedParams = (
  a: string,
  b: number,
  options?: { bar?: number; foo?: string },
  arr?: number[],
) => [a, b, options, arr];

const customTypeArrayParam = (testUsers: { firstName: string }[]) => [testUsers];
const customTypeSingleParam = (testUser: { firstName: string }) => [testUser];
const getWithParam = (firstName: string, lastName?: string) => [firstName, lastName];

describe('extractParamNamesAndDefaults', () => {
  it('should extract parameter names for noParams', () => {
    expect(extractParamNamesAndDefaults(noParams)).toEqual([]);
  });
  it('should extract parameter names for primitivesAndArray', () => {
    expect(extractParamNamesAndDefaults(primitivesAndArray)).toEqual([
      { name: 'var1' },
      { name: 'var2' },
      { name: 'var3' },
    ]);
  });
  it('should extract parameter names for objectOnly', () => {
    expect(extractParamNamesAndDefaults(objectOnly)).toEqual([{ name: 'options' }]);
  });
  it('should extract parameter names for mixedParams', () => {
    expect(extractParamNamesAndDefaults(mixedParams)).toEqual([
      { name: 'a' },
      { name: 'b' },
      { name: 'options' },
      { name: 'arr' },
    ]);
  });
  it('should extract parameter names for objectDestructured', () => {
    const actual = extractParamNamesAndDefaults(objectDestructured).map((p) => ({
      name: p.name.replaceAll(/\s+/gu, ' ').trim(),
    }));
    expect(actual).toEqual([{ name: '{ prop1, prop2 }' }]);
  });
  it('should extract parameter names for getWithParam', () => {
    expect(extractParamNamesAndDefaults(getWithParam)).toEqual([
      { name: 'firstName' },
      { name: 'lastName' },
    ]);
  });
});

describe('normalizeArgs', () => {
  it('should handle function with no params', () => {
    expect(normalizeArgs(noParams, undefined)).toEqual([]);
    expect(normalizeArgs(noParams, null)).toEqual([]);
    expect(normalizeArgs(noParams, {})).toEqual([]);
  });
  it('should handle single primitive var', () => {
    expect(normalizeArgs(primitivesAndArray, 'hello')).toEqual(['hello']);
  });
  it('should handle multiple vars as array', () => {
    expect(normalizeArgs(primitivesAndArray, ['hi', testNumber, ['a', 'b']])).toEqual([
      'hi',
      testNumber,
      ['a', 'b'],
    ]);
  });
  it('should handle object input for primitivesAndArray', () => {
    expect(
      normalizeArgs(primitivesAndArray, {
        var1: 'foo',
        var2: testVar2Number,
        var3: ['x', 'y'],
      }),
    ).toEqual(['foo', testVar2Number, ['x', 'y']]);
  });
  it('should handle missing keys (defaults)', () => {
    expect(normalizeArgs(primitivesAndArray, { var1: 'foo', var2: testVar2Number })).toEqual([
      'foo',
      testVar2Number,
      undefined,
    ]);
  });
  it('should handle objectOnly with single key', () => {
    expect(normalizeArgs(objectOnly, { foo: 'bar' })).toEqual([{ foo: 'bar' }]);
  });
  it('should handle objectOnly with multiple keys', () => {
    expect(normalizeArgs(objectOnly, { bar: 42, foo: 'bar' })).toEqual([{ bar: 42, foo: 'bar' }]);
  });
  it('should handle objectOnly with missing keys (defaults)', () => {
    expect(normalizeArgs(objectOnly, {})).toEqual([{}]);
  });
  it('should handle objectDestructured with both keys', () => {
    expect(normalizeArgs(objectDestructured, { prop1: 'foo', prop2: testNumber })).toEqual([
      { prop1: 'foo', prop2: testNumber },
    ]);
  });
  it('should handle objectDestructured with single key', () => {
    expect(normalizeArgs(objectDestructured, { prop1: 'foo' })).toEqual([
      { prop1: 'foo', prop2: undefined },
    ]);
  });
  it('should handle objectDestructured with missing keys', () => {
    expect(normalizeArgs(objectDestructured, {})).toEqual([{ prop1: undefined, prop2: undefined }]);
  });
  it('should handle mixed params as array', () => {
    expect(
      normalizeArgs(mixedParams, ['a', 1, { foo: 'bar' }, [testArrayFirst, testArraySecond]]),
    ).toEqual(['a', 1, { foo: 'bar' }, [testArrayFirst, testArraySecond]]);
  });
  it('should handle mixed params as object', () => {
    expect(
      normalizeArgs(mixedParams, {
        a: 'a',
        arr: [testArrayFirst, testArraySecond],
        b: 1,
        options: { foo: 'bar' },
      }),
    ).toEqual(['a', 1, { foo: 'bar' }, [testArrayFirst, testArraySecond]]);
  });
  it('should handle mixed params with missing keys (defaults)', () => {
    expect(normalizeArgs(mixedParams, { a: 'a', b: 1 })).toEqual(['a', 1, undefined, undefined]);
  });
  it('should handle customTypeArrayParam single param wrapper', () => {
    expect(normalizeArgs(customTypeArrayParam, { testUsers: [{ firstName: 'First' }] })).toEqual([
      [{ firstName: 'First' }],
    ]);
  });
  it('should handle customTypeSingleParam single param wrapper', () => {
    expect(normalizeArgs(customTypeSingleParam, { testUser: { firstName: 'First' } })).toEqual([
      { firstName: 'First' },
    ]);
  });
  it('should handle getWithParam with both keys', () => {
    expect(normalizeArgs(getWithParam, { firstName: 'Test', lastName: 'World' })).toEqual([
      'Test',
      'World',
    ]);
  });
  it('should handle getWithParam with missing optional key', () => {
    expect(normalizeArgs(getWithParam, { firstName: 'Test' })).toEqual(['Test', undefined]);
  });
});

describe('invokeWithParsedArgs', () => {
  it('should invoke function with no params', () => {
    expect(invokeWithParsedArgs(noParams, undefined)).toBe('noParams');
    expect(invokeWithParsedArgs(noParams, null)).toBe('noParams');
    expect(invokeWithParsedArgs(noParams, {})).toBe('noParams');
  });
  it('should invoke with single primitive', () => {
    expect(invokeWithParsedArgs(primitivesAndArray, 'hello')).toEqual([
      'hello',
      undefined,
      undefined,
    ]);
  });
  it('should invoke with array', () => {
    expect(invokeWithParsedArgs(primitivesAndArray, ['hi', testNumber, ['a', 'b']])).toEqual([
      'hi',
      testNumber,
      ['a', 'b'],
    ]);
  });
  it('should invoke with object', () => {
    expect(
      invokeWithParsedArgs(primitivesAndArray, {
        var1: 'foo',
        var2: testVar2Number,
        var3: ['x', 'y'],
      }),
    ).toEqual(['foo', testVar2Number, ['x', 'y']]);
  });
  it('should invoke with missing keys (defaults)', () => {
    expect(
      invokeWithParsedArgs(primitivesAndArray, {
        var1: 'foo',
        var2: testVar2Number,
      }),
    ).toEqual(['foo', testVar2Number, undefined]);
  });
  it('should invoke objectOnly with single key', () => {
    expect(invokeWithParsedArgs(objectOnly, { foo: 'bar' })).toEqual([{ foo: 'bar' }]);
  });
  it('should invoke objectOnly with multiple keys', () => {
    expect(invokeWithParsedArgs(objectOnly, { bar: testNumber, foo: 'bar' })).toEqual([
      { bar: testNumber, foo: 'bar' },
    ]);
  });
  it('should invoke objectOnly with missing keys (defaults)', () => {
    expect(invokeWithParsedArgs(objectOnly, {})).toEqual([{}]);
  });
  it('should invoke objectDestructured with both keys', () => {
    expect(
      invokeWithParsedArgs(objectDestructured, {
        prop1: 'foo',
        prop2: testNumber,
      }),
    ).toEqual([{ prop1: 'foo', prop2: testNumber }]);
  });
  it('should invoke objectDestructured with single key', () => {
    expect(invokeWithParsedArgs(objectDestructured, { prop1: 'foo' })).toEqual([
      { prop1: 'foo', prop2: undefined },
    ]);
  });
  it('should invoke objectDestructured with missing keys', () => {
    expect(invokeWithParsedArgs(objectDestructured, {})).toEqual([
      { prop1: undefined, prop2: undefined },
    ]);
  });
  it('should invoke mixed params as array', () => {
    expect(
      invokeWithParsedArgs(mixedParams, [
        'a',
        1,
        { foo: 'bar' },
        [testArrayFirst, testArraySecond],
      ]),
    ).toEqual(['a', 1, { foo: 'bar' }, [testArrayFirst, testArraySecond]]);
  });
  it('should invoke mixed params as object', () => {
    expect(
      invokeWithParsedArgs(mixedParams, {
        a: 'a',
        arr: [testArrayFirst, testArraySecond],
        b: 1,
        options: { foo: 'bar' },
      }),
    ).toEqual(['a', 1, { foo: 'bar' }, [testArrayFirst, testArraySecond]]);
  });
  it('should invoke mixed params with missing keys (defaults)', () => {
    expect(invokeWithParsedArgs(mixedParams, { a: 'a', b: 1 })).toEqual([
      'a',
      1,
      undefined,
      undefined,
    ]);
  });
  it('should invoke customTypeArrayParam with single param wrapper', () => {
    expect(
      invokeWithParsedArgs(customTypeArrayParam, { testUsers: [{ firstName: 'First' }] }),
    ).toEqual([[{ firstName: 'First' }]]);
  });
  it('should invoke customTypeSingleParam with single param wrapper', () => {
    expect(
      invokeWithParsedArgs(customTypeSingleParam, { testUser: { firstName: 'First' } }),
    ).toEqual([{ firstName: 'First' }]);
  });
  it('should invoke getWithParam with both keys', () => {
    expect(invokeWithParsedArgs(getWithParam, { firstName: 'Test', lastName: 'World' })).toEqual([
      'Test',
      'World',
    ]);
  });
  it('should invoke getWithParam with missing optional key', () => {
    expect(invokeWithParsedArgs(getWithParam, { firstName: 'Test' })).toEqual(['Test', undefined]);
  });
});
