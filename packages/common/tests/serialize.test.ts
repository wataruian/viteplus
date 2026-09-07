import { describe, expect, test } from 'vite-plus/test';

import { defaultIgnoredKeys, safeClone, safeSerialize } from '../src/utils/serialize';

describe('safeSerialize', () => {
  test('round-trips a plain object through JSON', () => {
    expect(safeSerialize({ a: 1, b: 'two', c: [3, 4] })).toStrictEqual({
      a: 1,
      b: 'two',
      c: [3, 4],
    });
  });

  test('redacts circular references instead of throwing', () => {
    const obj: Record<string, unknown> = { name: 'circular' };
    obj['self'] = obj;

    const result = safeSerialize(obj);
    expect(result).toMatchObject({ name: 'circular', self: '[Circular]' });
  });

  test('redacts keys passed via ignoredKeys, in addition to the built-in defaults', () => {
    const result = safeSerialize({ password: 'hunter2', username: 'bob' }, ['password']);
    expect(result).toStrictEqual({ password: '[Circular]', username: 'bob' });
    expect(defaultIgnoredKeys.has('password')).toBe(true);
  });

  test('passes primitives through unchanged', () => {
    expect(safeSerialize(42)).toBe(42);
    expect(safeSerialize('hello')).toBe('hello');
    expect(safeSerialize(null)).toBeNull();
  });
});

describe('safeClone', () => {
  test('deep-clones a plain object without sharing references', () => {
    const original = { nested: { value: 1 } };
    const clone = safeClone(original);

    expect(clone).toStrictEqual(original);
    expect(clone).not.toBe(original);
    expect(clone.nested).not.toBe(original.nested);
  });

  test('deep-clones arrays', () => {
    const original = [1, [2, 3], { a: 4 }];
    const clone = safeClone(original);

    expect(clone).toStrictEqual(original);
    expect(clone).not.toBe(original);
  });

  test('returns primitives as-is', () => {
    expect(safeClone(42)).toBe(42);
    expect(safeClone('hello')).toBe('hello');
    expect(safeClone(null)).toBeNull();
  });

  test('omits undefined-valued properties', () => {
    const original = { keep: 'yes', skip: undefined };
    const clone = safeClone(original);
    expect(clone).toStrictEqual({ keep: 'yes' });
  });
});
