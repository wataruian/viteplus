import { describe, expect, test } from 'vite-plus/test';

import { assertType, createTypeGuard, deepMerge } from '../src/typecast/tc';

const isString = (val: unknown): val is string => typeof val === 'string';
const isNumber = (val: unknown): val is number => typeof val === 'number';

describe('assertType', () => {
  test('returns the value when the predicate matches', () => {
    expect(assertType<string>('hello', isString)).toBe('hello');
  });

  test('throws a TypeError when the predicate does not match', () => {
    expect(() => {
      assertType<string>(42, isString);
    }).toThrow(TypeError);
    expect(() => {
      assertType<string>(42, isString);
    }).toThrow(/does not match the expected type/u);
  });
});

describe('createTypeGuard', () => {
  const isPerson = createTypeGuard<{ name: string; age: number }>({
    age: isNumber,
    name: isString,
  });

  test('returns true when the value matches every field predicate', () => {
    expect(isPerson({ age: 30, name: 'Ada' })).toBe(true);
  });

  test('returns false when the value is not a non-null object', () => {
    expect(isPerson(null)).toBe(false);
    expect(isPerson('not-an-object')).toBe(false);
    expect(isPerson([])).toBe(false);
  });

  test('returns false when a field fails its predicate', () => {
    expect(isPerson({ age: 'not-a-number', name: 'Ada' })).toBe(false);
  });

  test('returns false when a required field is missing', () => {
    expect(isPerson({ name: 'Ada' })).toBe(false);
  });

  test('ignores inherited (non-own) properties on the shape', () => {
    const shape: { own: (v: unknown) => v is string } = { own: isString };
    Object.setPrototypeOf(shape, { inherited: isString });
    const guard = createTypeGuard<{ own: string }>(shape);
    expect(guard({ inherited: 'ignored-but-present', own: 'value' })).toBe(true);
  });
});

describe('deepMerge', () => {
  test('merges flat objects, later keys overwriting earlier ones', () => {
    expect(deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 })).toStrictEqual({ a: 1, b: 3, c: 4 });
  });

  test('recursively merges nested plain objects', () => {
    const result = deepMerge({ nested: { a: 1, keep: 'yes' } }, { nested: { a: 2, added: true } });
    expect(result).toStrictEqual({ nested: { a: 2, added: true, keep: 'yes' } });
  });

  test('overwrites (does not merge) when the new value is not a non-null object', () => {
    expect(deepMerge({ a: { nested: true } }, { a: 'replaced' })).toStrictEqual({ a: 'replaced' });
  });

  test('overwrites when the existing value is not a non-null object but the new one is', () => {
    expect(deepMerge({ a: 'string-value' }, { a: { nested: true } })).toStrictEqual({
      a: { nested: true },
    });
  });

  test('returns an empty object when called with no arguments', () => {
    expect(deepMerge()).toStrictEqual({});
  });

  test('merges more than two objects in order', () => {
    expect(deepMerge({ a: 1 }, { b: 2 }, { a: 3, c: 4 })).toStrictEqual({ a: 3, b: 2, c: 4 });
  });
});
