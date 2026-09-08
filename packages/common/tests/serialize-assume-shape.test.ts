import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

const { assumeShapeMock } = vi.hoisted(() => ({
  assumeShapeMock: vi.fn<(val: unknown, dummy?: unknown) => boolean>(),
}));

vi.mock('../src/utils/helpers', () => ({
  assumeShape: assumeShapeMock,
}));

afterEach(() => {
  assumeShapeMock.mockReset();
});

describe('safeSerialize when assumeShape cannot narrow the parsed result', () => {
  test('throws', async () => {
    vi.resetModules();
    assumeShapeMock.mockReturnValue(false);
    const { safeSerialize } = await import('../src/utils/serialize');

    expect(() => safeSerialize({ a: 1 })).toThrow(
      'unreachable: assumeShape always narrows successfully',
    );
  });
});

describe('safeClone when assumeShape cannot narrow an array-clone result', () => {
  test('falls through to returning the original array unchanged', async () => {
    vi.resetModules();
    assumeShapeMock.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const { safeClone } = await import('../src/utils/serialize');

    const original = [1, 2, 3];
    expect(safeClone(original)).toBe(original);
  });
});

describe('safeClone when assumeShape rejects a non-array, non-record value', () => {
  test('returns the source unchanged', async () => {
    vi.resetModules();
    assumeShapeMock.mockReturnValue(false);
    const { safeClone } = await import('../src/utils/serialize');

    const original = { a: 1 };
    expect(safeClone(original)).toBe(original);
  });
});

describe('safeClone when assumeShape cannot narrow the cloned record result', () => {
  test('throws', async () => {
    vi.resetModules();
    assumeShapeMock.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const { safeClone } = await import('../src/utils/serialize');

    expect(() => safeClone({ a: 1 })).toThrow(
      'unreachable: assumeShape always narrows successfully',
    );
  });
});
