import { describe, expect, it } from 'vitest';
import {
  extractParamNamesAndDefaults,
  invokeWithParsedArgs,
  normalizeArgs,
} from '../src/utils/invoker';

const TEST_NUMBER = 42;
const TEST_VAR2_NUMBER = 7;
const TEST_ARRAY_FIRST = 9;
const TEST_ARRAY_SECOND = 8;

const noParams = (() => 'noParams') as (...args: unknown[]) => unknown;
const primitivesAndArray = ((var1: string, var2: number, var3?: string[]) => [
  var1,
  var2,
  var3,
]) as (...args: unknown[]) => unknown;
const objectOnly = ((options: { bar?: number; foo?: string }) => [options]) as (
  ...args: unknown[]
) => unknown;
const objectDestructured = (({
  prop1,
  prop2,
}: {
  prop1?: string;
  prop2?: number;
}) => [{ prop1, prop2 }]) as (...args: unknown[]) => unknown;
const mixedParams = ((
  a: string,
  b: number,
  options?: { bar?: number; foo?: string },
  arr?: number[]
) => [a, b, options, arr]) as (...args: unknown[]) => unknown;

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
    expect(extractParamNamesAndDefaults(objectOnly)).toEqual([
      { name: 'options' },
    ]);
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
    const actual = extractParamNamesAndDefaults(objectDestructured).map(p => ({
      name: p.name.replaceAll(/\s+/g, ' ').trim(),
    }));
    expect(actual).toEqual([{ name: '{ prop1, prop2 }' }]);
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
    expect(
      normalizeArgs(primitivesAndArray, ['hi', TEST_NUMBER, ['a', 'b']])
    ).toEqual(['hi', TEST_NUMBER, ['a', 'b']]);
  });
  it('should handle object input for primitivesAndArray', () => {
    expect(
      normalizeArgs(primitivesAndArray, {
        var1: 'foo',
        var2: TEST_VAR2_NUMBER,
        var3: ['x', 'y'],
      })
    ).toEqual(['foo', TEST_VAR2_NUMBER, ['x', 'y']]);
  });
  it('should handle missing keys (defaults)', () => {
    expect(
      normalizeArgs(primitivesAndArray, { var1: 'foo', var2: TEST_VAR2_NUMBER })
    ).toEqual(['foo', TEST_VAR2_NUMBER, undefined]);
  });
  it('should handle objectOnly with single key', () => {
    expect(normalizeArgs(objectOnly, { foo: 'bar' })).toEqual([{ foo: 'bar' }]);
  });
  it('should handle objectOnly with multiple keys', () => {
    expect(normalizeArgs(objectOnly, { bar: 42, foo: 'bar' })).toEqual([
      { bar: 42, foo: 'bar' },
    ]);
  });
  it('should handle objectOnly with missing keys (defaults)', () => {
    expect(normalizeArgs(objectOnly, {})).toEqual([{}]);
  });
  it('should handle objectDestructured with both keys', () => {
    expect(
      normalizeArgs(objectDestructured, { prop1: 'foo', prop2: TEST_NUMBER })
    ).toEqual([{ prop1: 'foo', prop2: TEST_NUMBER }]);
  });
  it('should handle objectDestructured with single key', () => {
    expect(normalizeArgs(objectDestructured, { prop1: 'foo' })).toEqual([
      { prop1: 'foo', prop2: undefined },
    ]);
  });
  it('should handle objectDestructured with missing keys', () => {
    expect(normalizeArgs(objectDestructured, {})).toEqual([
      { prop1: undefined, prop2: undefined },
    ]);
  });
  it('should handle mixed params as array', () => {
    expect(
      normalizeArgs(mixedParams, [
        'a',
        1,
        { foo: 'bar' },
        [TEST_ARRAY_FIRST, TEST_ARRAY_SECOND],
      ])
    ).toEqual(['a', 1, { foo: 'bar' }, [TEST_ARRAY_FIRST, TEST_ARRAY_SECOND]]);
  });
  it('should handle mixed params as object', () => {
    expect(
      normalizeArgs(mixedParams, {
        a: 'a',
        arr: [TEST_ARRAY_FIRST, TEST_ARRAY_SECOND],
        b: 1,
        options: { foo: 'bar' },
      })
    ).toEqual(['a', 1, { foo: 'bar' }, [TEST_ARRAY_FIRST, TEST_ARRAY_SECOND]]);
  });
  it('should handle mixed params with missing keys (defaults)', () => {
    expect(normalizeArgs(mixedParams, { a: 'a', b: 1 })).toEqual([
      'a',
      1,
      undefined,
      undefined,
    ]);
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
    expect(
      invokeWithParsedArgs(primitivesAndArray, ['hi', TEST_NUMBER, ['a', 'b']])
    ).toEqual(['hi', TEST_NUMBER, ['a', 'b']]);
  });
  it('should invoke with object', () => {
    expect(
      invokeWithParsedArgs(primitivesAndArray, {
        var1: 'foo',
        var2: TEST_VAR2_NUMBER,
        var3: ['x', 'y'],
      })
    ).toEqual(['foo', TEST_VAR2_NUMBER, ['x', 'y']]);
  });
  it('should invoke with missing keys (defaults)', () => {
    expect(
      invokeWithParsedArgs(primitivesAndArray, {
        var1: 'foo',
        var2: TEST_VAR2_NUMBER,
      })
    ).toEqual(['foo', TEST_VAR2_NUMBER, undefined]);
  });
  it('should invoke objectOnly with single key', () => {
    expect(invokeWithParsedArgs(objectOnly, { foo: 'bar' })).toEqual([
      { foo: 'bar' },
    ]);
  });
  it('should invoke objectOnly with multiple keys', () => {
    expect(
      invokeWithParsedArgs(objectOnly, { bar: TEST_NUMBER, foo: 'bar' })
    ).toEqual([{ bar: TEST_NUMBER, foo: 'bar' }]);
  });
  it('should invoke objectOnly with missing keys (defaults)', () => {
    expect(invokeWithParsedArgs(objectOnly, {})).toEqual([{}]);
  });
  it('should invoke objectDestructured with both keys', () => {
    expect(
      invokeWithParsedArgs(objectDestructured, {
        prop1: 'foo',
        prop2: TEST_NUMBER,
      })
    ).toEqual([{ prop1: 'foo', prop2: TEST_NUMBER }]);
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
        [TEST_ARRAY_FIRST, TEST_ARRAY_SECOND],
      ])
    ).toEqual(['a', 1, { foo: 'bar' }, [TEST_ARRAY_FIRST, TEST_ARRAY_SECOND]]);
  });
  it('should invoke mixed params as object', () => {
    expect(
      invokeWithParsedArgs(mixedParams, {
        a: 'a',
        arr: [TEST_ARRAY_FIRST, TEST_ARRAY_SECOND],
        b: 1,
        options: { foo: 'bar' },
      })
    ).toEqual(['a', 1, { foo: 'bar' }, [TEST_ARRAY_FIRST, TEST_ARRAY_SECOND]]);
  });
  it('should invoke mixed params with missing keys (defaults)', () => {
    expect(invokeWithParsedArgs(mixedParams, { a: 'a', b: 1 })).toEqual([
      'a',
      1,
      undefined,
      undefined,
    ]);
  });
});
