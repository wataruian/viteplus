import { describe, expect, test } from 'vite-plus/test';

import { classPrefix, combineClasses, extract, getStyles } from '../src/utils/helpers';

describe('classPrefix', () => {
  test('is the "ds" design-system prefix', () => {
    expect(classPrefix).toBe('ds');
  });
});

describe('combineClasses', () => {
  test('joins string classes and ignores falsy values', () => {
    expect(combineClasses('a', null, undefined, false, 'b')).toBe('a b');
  });

  test('splits multi-class strings and dedupes across arguments', () => {
    expect(combineClasses('a b', 'b c')).toBe('a b c');
  });

  test('returns an empty string when given nothing usable', () => {
    expect(combineClasses(null, undefined, false)).toBe('');
  });
});

describe('extract', () => {
  test('collects a single string into the result array', () => {
    const result: string[] = [];
    extract('a', result);
    expect(result).toStrictEqual(['a']);
  });

  test('recursively collects strings from nested arrays and objects', () => {
    const result: string[] = [];
    extract(['a', { b: 'b', c: ['c', { d: 'd' }] }], result);
    expect(result).toStrictEqual(['a', 'b', 'c', 'd']);
  });

  test('ignores non-string, non-object, non-array values', () => {
    const result: string[] = [];
    extract(42, result);
    extract(null, result);
    extract(undefined, result);
    expect(result).toStrictEqual([]);
  });
});

describe('getStyles', () => {
  test('flattens and dedupes classes from multiple style sources', () => {
    expect(getStyles('a b', { intent: 'a c' }, ['d', 'd'])).toBe('a b c d');
  });

  test('returns an empty string when given no styles', () => {
    expect(getStyles()).toBe('');
  });
});
