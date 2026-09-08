import { describe, expect, test } from 'vite-plus/test';

import {
  generateColorScale,
  generateThemeCss,
  getCSS,
  getLightnessStops,
  getThemeColors,
  getThemes,
  makeOklch,
  oklchToRgbTuple,
  parseToOklch,
  themes,
} from '../src/utils/theme-generator';

describe('themes', () => {
  test('every theme has at least a primary and accent color', () => {
    for (const [name, colors] of Object.entries(themes)) {
      expect(colors.primary, `${name}.primary`).toMatch(/^#[\da-f]{6}$/iu);
      expect(colors.accent, `${name}.accent`).toMatch(/^#[\da-f]{6}$/iu);
    }
  });
});

describe('parseToOklch', () => {
  test('parses a valid hex color into an Oklch object', () => {
    const result = parseToOklch('#ff0000');
    expect(result.mode).toBe('oklch');
    expect(result.l).toBeGreaterThan(0);
  });

  test('throws for an unparseable color string', () => {
    expect(() => parseToOklch('not-a-color')).toThrow(/Cannot parse color/u);
  });
});

describe('oklchToRgbTuple', () => {
  test('converts pure white to "255 255 255"', () => {
    expect(oklchToRgbTuple(makeOklch(1, 0, 0))).toBe('255 255 255');
  });

  test('converts pure black to "0 0 0"', () => {
    expect(oklchToRgbTuple(makeOklch(0, 0, 0))).toBe('0 0 0');
  });

  test('clamps out-of-gamut chroma instead of producing invalid output', () => {
    const result = oklchToRgbTuple(makeOklch(0.5, 5, 30));
    const parts = result.split(' ').map(Number);
    expect(parts).toHaveLength(3);
    for (const channel of parts) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  });
});

describe('generateColorScale', () => {
  test('produces one CSS custom-property line per lightness stop, each a valid "r g b" triplet', () => {
    const stops = getLightnessStops();
    const css = generateColorScale('#8b5cf6', 'primary');
    const lines = css.split('\n');
    expect(lines).toHaveLength(stops.length);

    for (const [index, stop] of stops.entries()) {
      const line = lines[index];
      expect(line).toContain(`--ds-primary-${stop}:`);

      const match = /:\s*(?<red>\d+) (?<green>\d+) (?<blue>\d+);$/u.exec(line);
      expect(match, `line for stop ${stop} should match an "r g b" triplet`).not.toBeNull();
    }
  });

  test('reduces chroma for surface scales relative to the same hex as a non-surface scale', () => {
    const normal = generateColorScale('#8b5cf6', 'x');
    const surfaceScale = generateColorScale('#8b5cf6', 'x', true);
    expect(surfaceScale).not.toBe(normal);
  });
});

describe('getThemeColors', () => {
  test('returns a UnoCSS color object with every stop plus DEFAULT', () => {
    const stops = getLightnessStops();
    const colors = getThemeColors('primary');

    for (const stop of stops) {
      expect(colors[stop]).toBe(`rgb(var(--ds-primary-${stop}) / <alpha-value>)`);
    }
    expect(colors['DEFAULT']).toBe('rgb(var(--ds-primary-base))');
  });
});

describe('getThemes / generateThemeCss / getCSS', () => {
  test('getThemes returns a UnoCSS theme object with a colors map', () => {
    const result = getThemes();
    expect(result.colors.primary['DEFAULT']).toMatch(/^rgb\(var\(--ds-primary-base\)/u);
  });

  test('generateThemeCss produces a CSS rule scoped to the given class name', () => {
    const css = generateThemeCss('.theme-emerald', { accent: '#3b82f6', primary: '#10b981' });
    expect(css).toContain('.theme-emerald');
    expect(css).toContain('--ds-primary-base');
  });

  test('getCSS assembles the full stylesheet without throwing', () => {
    const css = getCSS();
    expect(typeof css).toBe('string');
    expect(css.length).toBeGreaterThan(0);
  });

  test('generateThemeCss throws when the primary color is missing', () => {
    expect(() => generateThemeCss('.broken', { accent: '#3b82f6', primary: '' })).toThrow(
      'Primary color is required',
    );
  });

  test('generateThemeCss throws when the accent color is missing', () => {
    expect(() => generateThemeCss('.broken', { accent: '', primary: '#8b5cf6' })).toThrow(
      'Accent color is required',
    );
  });

  test('generateThemeCss uses the provided danger/success/warning/info/surface colors instead of the defaults', () => {
    const withDefaults = generateThemeCss('.custom', {
      accent: '#3b82f6',
      primary: '#8b5cf6',
    });

    const withOverrides = generateThemeCss('.custom', {
      accent: '#3b82f6',
      danger: '#111111',
      info: '#222222',
      primary: '#8b5cf6',
      success: '#333333',
      surface: '#444444',
      warning: '#555555',
    });

    expect(withOverrides).not.toBe(withDefaults);
  });
});
