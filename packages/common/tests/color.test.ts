import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import type * as ColorModule from '../src/utils/color';

const importFreshColorModule = async (chalkLevel?: string): Promise<typeof ColorModule> => {
  vi.resetModules();
  vi.stubEnv('CHALK_LEVEL', chalkLevel);
  return await import('../src/utils/color');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('module-level chalk level configuration', () => {
  test.each([
    { chalkLevel: '0', expectedLevel: 0 },
    { chalkLevel: '1', expectedLevel: 1 },
    { chalkLevel: '2', expectedLevel: 2 },
    { chalkLevel: '3', expectedLevel: 3 },
    { chalkLevel: undefined, expectedLevel: 3 },
    { chalkLevel: 'not-a-number', expectedLevel: 3 },
    { chalkLevel: '99', expectedLevel: 3 },
    { chalkLevel: '-5', expectedLevel: 0 },
  ])(
    'sets chalk.level to $expectedLevel for CHALK_LEVEL=$chalkLevel',
    async ({ chalkLevel, expectedLevel }) => {
      const color = await importFreshColorModule(chalkLevel);
      expect(color.chalkInstance.level).toBe(expectedLevel);
      expect(color.normalizedChalkLevel).toBe(expectedLevel);
    },
  );

  test('exposes the raw env value and the parsed numeric level', async () => {
    const color = await importFreshColorModule('2');
    expect(color.chalkLevelEnv).toBe('2');
    expect(color.parsedLevel).toBe(2);
  });

  test('defaults chalkLevelEnv to the stringified default level when unset', async () => {
    const color = await importFreshColorModule(undefined);
    expect(color.chalkLevelEnv).toBe(String(color.defaultChalkLevel));
  });
});

describe('getRandomColor', () => {
  test('returns defaultColor for the sentinel "no-id"', async () => {
    const { defaultColor, getRandomColor } = await importFreshColorModule();
    expect(getRandomColor('no-id')).toBe(defaultColor);
  });

  test('generates a random id when called with no id or an empty string', async () => {
    const { colors, getRandomColor } = await importFreshColorModule();
    expect(colors).toContain(getRandomColor());
    expect(colors).toContain(getRandomColor(''));
  });

  test('caches the color per id and returns the same color on repeat calls', async () => {
    const { getRandomColor } = await importFreshColorModule();
    const first = getRandomColor('session-a');
    const second = getRandomColor('session-a');
    expect(second).toBe(first);
  });

  test('cycles through the color palette across distinct ids', async () => {
    const { colors, getRandomColor } = await importFreshColorModule();
    const assigned = Array.from({ length: colors.length + 2 }, (_v, i) =>
      getRandomColor(`id-${i}`),
    );
    expect(assigned[colors.length]).toBe(assigned[0]);
  });

  test('evicts the oldest entry once the session cache exceeds 1000 ids', async () => {
    const { getRandomColor, sessionColors } = await importFreshColorModule();
    for (let i = 0; i < 1001; i += 1) {
      getRandomColor(`evict-${i}`);
    }
    expect(sessionColors.size).toBe(1000);
    expect(sessionColors.has('evict-0')).toBe(false);
    expect(sessionColors.has('evict-1000')).toBe(true);
  });
});

describe('getNextRandomColor', () => {
  test('generates a random id when the given id is empty', async () => {
    const { colors, getNextRandomColor } = await importFreshColorModule();
    const { nextColor } = getNextRandomColor('', undefined);
    expect(colors).toContain(nextColor);
  });

  test('returns the freshly generated color when there is no previous color', async () => {
    const { getNextRandomColor, getRandomColor } = await importFreshColorModule();
    const result = getNextRandomColor('some-id', undefined);
    expect(result.nextColor).toBe(getRandomColor('some-id'));
    expect(result.previousColor).toBeUndefined();
  });

  test('returns the newly resolved color when it differs from the previous one', async () => {
    const { getNextRandomColor, getRandomColor } = await importFreshColorModule();
    const previousColor = getRandomColor('id-a');
    const result = getNextRandomColor('id-b', previousColor);
    expect(result.nextColor).toBe(getRandomColor('id-b'));
    expect(result.previousColor).toBe(previousColor);
  });

  test('advances to the next palette color when the resolved color matches the previous one', async () => {
    const { colors, getNextRandomColor, getRandomColor } = await importFreshColorModule();
    const color = getRandomColor('same-id');
    const result = getNextRandomColor('same-id', color);
    const expectedIndex = (colors.indexOf(color) + 1) % colors.length;
    expect(result.nextColor).toBe(colors[expectedIndex]);
    expect(result.previousColor).toBe(color);
  });
});

const identity = (text: string) => text;

describe('getAnsiEscapeCodes', () => {
  test('extracts the opening escape code and returns the shared reset code when colorized', async () => {
    const { colors, getAnsiEscapeCodes, resetColorAnsiEscapeCode } =
      await importFreshColorModule('3');
    const [colorFn] = colors;
    const codes = getAnsiEscapeCodes(colorFn);
    expect(codes.open).toMatch(/^\[/u);
    expect(codes.close).toBe(resetColorAnsiEscapeCode);
  });

  test('returns empty codes when the color function adds no ANSI escape codes', async () => {
    const { getAnsiEscapeCodes } = await importFreshColorModule('3');
    expect(getAnsiEscapeCodes(identity)).toStrictEqual({ close: '', open: '' });
  });
});
