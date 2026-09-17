import { describe, expect, test } from 'vite-plus/test';

import {
  escapeRegExp,
  generateShortUuid,
  generateUuid,
  getRandomText,
  padEmoji,
  safeToString,
  toPascalCase,
  upperCaseFirstLetter,
  uppercasePerWord,
} from '../src/utils/text';

describe('getRandomText', () => {
  test('returns a non-empty base36 string', () => {
    const text = getRandomText();
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/^[\d a-z]+$/u);
  });

  test('returns different values across calls', () => {
    expect(getRandomText()).not.toBe(getRandomText());
  });
});

describe('safeToString', () => {
  test('returns an empty string for null and undefined', () => {
    expect(safeToString(null)).toBe('');
    expect(safeToString(undefined)).toBe('');
  });

  test('passes strings through unchanged', () => {
    expect(safeToString('hello')).toBe('hello');
  });

  test('JSON-stringifies plain objects and arrays', () => {
    expect(safeToString({ a: 1 })).toBe('{"a":1}');
    expect(safeToString([1, 2, 3])).toBe('[1,2,3]');
  });

  test('throws when JSON.stringify fails on a circular object', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => safeToString(circular)).toThrow(/Failed to convert object to string/u);
  });

  test('stringifies booleans, numbers, bigints, and symbols via String()', () => {
    expect(safeToString(true)).toBe('true');
    expect(safeToString(42)).toBe('42');
    expect(safeToString(10n)).toBe('10');
    expect(safeToString(Symbol('s'))).toBe('Symbol(s)');
  });

  test('falls back to Object.prototype.toString for functions', () => {
    expect(safeToString(() => {})).toBe('[object Function]');
  });

  test('throws when Object.prototype.toString itself fails for an exotic function', () => {
    const evilFn = new Proxy(() => {}, {
      get(target, prop, receiver): unknown {
        if (prop === Symbol.toStringTag) {
          throw new Error('boom');
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    expect(() => safeToString(evilFn)).toThrow(/Failed to convert function value to string/u);
  });
});

describe('generateUuid', () => {
  test('returns a valid UUID', () => {
    expect(generateUuid()).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
  });
});

describe('generateShortUuid', () => {
  test('defaults to a 7-character hex string', () => {
    const id = generateShortUuid();
    expect(id).toHaveLength(7);
    expect(id).toMatch(/^[\da-f]+$/u);
  });

  test('respects a custom length', () => {
    expect(generateShortUuid(4)).toHaveLength(4);
    expect(generateShortUuid(12)).toHaveLength(12);
  });
});

describe('padEmoji', () => {
  test('pads a short non-emoji string on the right by default', () => {
    expect(padEmoji('a', 4)).toBe('a   ');
  });

  test('pads on the left when padRight is false', () => {
    expect(padEmoji('a', 4, ' ', false)).toBe('   a');
  });

  test('treats a high-codepoint character as width 2', () => {
    expect(padEmoji('🚀', 4)).toBe('🚀  ');
  });

  test('adds a trailing space when addSpace is true', () => {
    expect(padEmoji('🚀', 4, ' ', true, true)).toBe('🚀  ');
  });

  test('returns just padding when emoji is empty', () => {
    expect(padEmoji('', 3)).toBe('   ');
  });
});

describe('upperCaseFirstLetter', () => {
  test('uppercases only the first letter', () => {
    expect(upperCaseFirstLetter('hello world')).toBe('Hello world');
  });
});

describe('uppercasePerWord', () => {
  test('uppercases the first letter of every word', () => {
    expect(uppercasePerWord('hello there world')).toBe('Hello There World');
  });
});

describe('escapeRegExp', () => {
  test('prefixes every regex metacharacter with a backslash', () => {
    const special = String.raw`$()*+.?[\]^{|}`;
    expect(escapeRegExp(special)).toBe(String.raw`\$\(\)\*\+\.\?\[\\\]\^\{\|\}`);
  });

  test('leaves ordinary characters unchanged', () => {
    expect(escapeRegExp('hello-world_123')).toBe('hello-world_123');
  });

  test('produces a pattern that matches the original string literally, not as a wildcard', () => {
    const value = 'http://localhost:3000';
    const pattern = new RegExp(`^${escapeRegExp(value)}$`, 'u');

    expect(pattern.test(value)).toBe(true);
    expect(pattern.test('http://localhostx3000')).toBe(false);
  });

  test('produces a valid, non-throwing pattern from a string containing unresolved template syntax', () => {
    const value = `http://localhost:\${API_PORT}`;

    expect(() => new RegExp(`^${escapeRegExp(value)}$`, 'u')).not.toThrow();
    expect(new RegExp(`^${escapeRegExp(value)}$`, 'u').test(value)).toBe(true);
  });

  test('returns an empty string unchanged', () => {
    expect(escapeRegExp('')).toBe('');
  });
});

describe('toPascalCase', () => {
  test('converts a kebab-case string to PascalCase', () => {
    expect(toPascalCase('my-component-name')).toBe('MyComponentName');
  });

  test('handles a single word', () => {
    expect(toPascalCase('button')).toBe('Button');
  });
});
