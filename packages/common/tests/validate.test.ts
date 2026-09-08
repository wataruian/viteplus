import { describe, expect, test } from 'vite-plus/test';

import {
  checkDuplicateExports,
  isCallable,
  isModuleExports,
  isNonNullObject,
  isPlainObject,
  isRecord,
  isRecordArray,
} from '../src/validators/validate';

describe('isPlainObject', () => {
  test('returns true for plain objects and arrays', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject([])).toBe(true);
  });

  test('returns false for null and primitives', () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject('str')).toBe(false);
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
  });
});

describe('isRecord', () => {
  test('returns true for a plain object', () => {
    expect(isRecord({ a: 1 })).toBe(true);
  });

  test('returns false for arrays', () => {
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  test('returns false for null and primitives', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord('str')).toBe(false);
    expect(isRecord(42)).toBe(false);
  });
});

describe('isRecordArray', () => {
  test('returns true for an array of records', () => {
    expect(isRecordArray([{ a: 1 }, { b: 2 }])).toBe(true);
  });

  test('returns true for an empty array', () => {
    expect(isRecordArray([])).toBe(true);
  });

  test('returns false when any item is not a record', () => {
    expect(isRecordArray([{ a: 1 }, 'nope'])).toBe(false);
  });

  test('returns false for a non-array value', () => {
    expect(isRecordArray({ a: 1 })).toBe(false);
  });
});

describe('isCallable', () => {
  test('returns true for functions', () => {
    expect(isCallable(() => {})).toBe(true);
    expect(isCallable(() => undefined)).toBe(true);
  });

  test('returns false for non-functions', () => {
    expect(isCallable({})).toBe(false);
    expect(isCallable('fn')).toBe(false);
    expect(isCallable(null)).toBe(false);
    expect(isCallable(undefined)).toBe(false);
  });
});

describe('isNonNullObject', () => {
  test('returns true for a plain object', () => {
    expect(isNonNullObject({ a: 1 })).toBe(true);
  });

  test('returns false for null', () => {
    expect(isNonNullObject(null)).toBe(false);
  });

  test('returns false for arrays', () => {
    expect(isNonNullObject([1, 2])).toBe(false);
  });

  test('returns false for primitives', () => {
    expect(isNonNullObject('str')).toBe(false);
    expect(isNonNullObject(42)).toBe(false);
  });
});

describe('isModuleExports', () => {
  test('returns true for a plain object', () => {
    expect(isModuleExports({ foo: 'bar' })).toBe(true);
  });

  test('returns false for null and arrays', () => {
    expect(isModuleExports(null)).toBe(false);
    expect(isModuleExports([])).toBe(false);
  });
});

describe('checkDuplicateExports', () => {
  test('does not throw when nested modules export unique names', () => {
    expect(() => {
      checkDuplicateExports({
        moduleA: { foo: () => {}, nested: { bar: () => {} } },
        moduleB: { baz: () => {} },
      });
    }).not.toThrow();
  });

  test('does not treat exports under different module names as duplicates', () => {
    expect(() => {
      checkDuplicateExports({
        moduleA: { shared: () => {} },
        moduleB: { shared: () => {} },
      });
    }).not.toThrow();
  });

  test('throws a descriptive error when two entries collide on their flattened dot-joined path', () => {
    expect(() => {
      checkDuplicateExports({
        moduleA: { nested: { shared: () => {} } },
        'moduleA.nested': { shared: () => {} },
      });
    }).toThrow(/Duplicate exports detected/u);
  });

  test('includes the colliding export path in the error message', () => {
    expect(() => {
      checkDuplicateExports({
        moduleA: { nested: { shared: 'value-a' } },
        'moduleA.nested': { shared: 'value-b' },
      });
    }).toThrow(/moduleA\.nested\.shared/u);
  });
});
