import { describe, expect, test } from 'vite-plus/test';

import {
  readArray,
  readNumber,
  readRecord,
  readScalarAsString,
  readString,
  readStringRecord,
} from '../src/helpers/json';

describe('readStringRecord', () => {
  test('keeps only string-valued entries', () => {
    expect(readStringRecord({ a: 'x', b: 1, c: 'y' })).toStrictEqual({ a: 'x', c: 'y' });
  });

  test('returns an empty object for non-objects', () => {
    expect(readStringRecord('nope')).toStrictEqual({});
    expect(readStringRecord(undefined)).toStrictEqual({});
    expect(readStringRecord(null)).toStrictEqual({});
  });
});

describe('readRecord', () => {
  test('copies plain object entries', () => {
    expect(readRecord({ a: 1, b: 'two' })).toStrictEqual({ a: 1, b: 'two' });
  });

  test('returns an empty object for non-objects', () => {
    expect(readRecord('nope')).toStrictEqual({});
    expect(readRecord(null)).toStrictEqual({});
  });
});

describe('readArray', () => {
  test('returns the array as-is', () => {
    const value = [1, 2, 3];
    expect(readArray(value)).toBe(value);
  });

  test('returns an empty array for non-arrays', () => {
    expect(readArray({ length: 0 })).toStrictEqual([]);
    expect(readArray(undefined)).toStrictEqual([]);
  });
});

describe('readString', () => {
  test('returns the value only when it is a string', () => {
    expect(readString('x')).toBe('x');
    expect(readString(1)).toBeUndefined();
    expect(readString(undefined)).toBeUndefined();
  });
});

describe('readNumber', () => {
  test('returns the value only when it is a number', () => {
    expect(readNumber(42)).toBe(42);
    expect(readNumber('42')).toBeUndefined();
    expect(readNumber(undefined)).toBeUndefined();
  });
});

describe('readScalarAsString', () => {
  test('passes strings through unchanged', () => {
    expect(readScalarAsString('x')).toBe('x');
  });

  test('stringifies numbers', () => {
    expect(readScalarAsString(42)).toBe('42');
    expect(readScalarAsString(0)).toBe('0');
  });

  test('returns undefined for anything else', () => {
    expect(readScalarAsString(true)).toBeUndefined();
    expect(readScalarAsString(undefined)).toBeUndefined();
    expect(readScalarAsString(null)).toBeUndefined();
  });
});
