import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import {
  decodeShortUuid,
  describeError,
  escapeRegExp,
  generateShortUuid,
  generateUuid,
  getRandomText,
  padEmoji,
  safeToString,
  toPascalCase,
  upperCaseFirstLetter,
  uppercasePerWord,
} from '../../src/utils/text';

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('is 22 letters and digits (base62), with no - or _', () => {
    expect(generateShortUuid()).toMatch(/^[\dA-Za-z]{22}$/u);
  });

  test('losslessly encodes a v4 UUID from generateUuid, which decodeShortUuid recovers', () => {
    const uuid = 'f81d4fae-7dec-41d0-a765-00a0c91e6bf6';
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(uuid);

    const shortUuid = generateShortUuid();

    expect(shortUuid).toBe('7YBUWgZR2uaVcbPD3vYJS2');
    expect(decodeShortUuid(shortUuid)).toBe(uuid);
  });

  test('round-trips every generated id back to a v4 UUID', () => {
    for (let index = 0; index < 1000; index += 1) {
      expect(decodeShortUuid(generateShortUuid())).toMatch(
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u,
      );
    }
  });

  test('keeps leading zeros, so every id is exactly 22 characters', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(
      '00000000-0000-4000-8000-000000000001',
    );

    const shortUuid = generateShortUuid();

    expect(shortUuid).toBe('000000001VgEh72lXvTXkH');
    expect(decodeShortUuid(shortUuid)).toBe('00000000-0000-4000-8000-000000000001');
  });

  test('rejects anything that is not base62', () => {
    expect(() => decodeShortUuid('not-a-short-uuid')).toThrow(TypeError);
  });

  test('takes its randomness from crypto.randomUUID (a CSPRNG), one UUID per id', () => {
    const randomUuid = vi.spyOn(globalThis.crypto, 'randomUUID');

    generateShortUuid();
    generateShortUuid();

    expect(randomUuid).toHaveBeenCalledTimes(2);
  });

  test.each<[string, ReturnType<typeof globalThis.crypto.randomUUID>, string]>([
    ['the smallest UUID', '00000000-0000-0000-0000-000000000000', '0000000000000000000000'],
    ['the largest UUID', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '7n42DGM5Tflk9n8mt7Fhc7'],
  ])('encodes %s within 22 characters and decodes it back', (_label, uuid, shortUuid) => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(uuid);

    expect(generateShortUuid()).toBe(shortUuid);
    expect(decodeShortUuid(shortUuid)).toBe(uuid);
  });

  test('is one-to-one: distinct UUIDs always give distinct ids (decoding recovers each UUID)', () => {
    for (let index = 0; index < 10_000; index += 1) {
      const uuid = generateUuid();
      vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(uuid);

      expect(decodeShortUuid(generateShortUuid())).toBe(uuid);
    }
  });

  test('does not repeat across 1M ids (122 random bits, nothing truncated)', () => {
    const ids = new Set(Array.from({ length: 1_000_000 }, () => generateShortUuid()));

    expect(ids.size).toBe(1_000_000);
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
    const value = 'http://localhost:2000';
    const pattern = new RegExp(`^${escapeRegExp(value)}$`, 'u');

    expect(pattern.test(value)).toBe(true);
    expect(pattern.test('http://localhostx2000')).toBe(false);
  });

  test('produces a valid, non-throwing pattern from a string containing unresolved template syntax', () => {
    const value = `http://localhost:\${BACKEND_PORT}`;

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

describe('describeError', () => {
  test("is an Error's message, or the value stringified", () => {
    expect(describeError(new Error('boom'))).toBe('boom');
    expect(describeError('plain')).toBe('plain');
    expect(describeError(Object.assign(Object.create(null), { code: 7 }))).toBe('{"code":7}');
  });
});
