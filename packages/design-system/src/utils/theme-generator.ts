import { type Oklch, clampChroma, converter, parse } from 'culori';
import { classPrefix } from './helpers';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ThemeColors {
  accent: string;
  danger: string;
  info: string;
  primary: string;
  success: string;
  surface?: string | undefined;
  warning: string;
}

type ColorScale = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

// ─── Themes ──────────────────────────────────────────────────────────────────

const themes: Record<string, ThemeColors> = {
  default: {
    accent: '#10b981',
    danger: '#ef4444',
    info: '#3b82f6',
    primary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
  },
  emerald: {
    accent: '#3b82f6',
    danger: '#ef4444',
    info: '#3b82f6',
    primary: '#10b981',
    success: '#10b981',
    warning: '#f59e0b',
  },
  ocean: {
    accent: '#8b5cf6',
    danger: '#ef4444',
    info: '#3b82f6',
    primary: '#0ea5e9',
    success: '#10b981',
    warning: '#f59e0b',
  },
  sunset: {
    accent: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    primary: '#f43f5e',
    success: '#10b981',
    warning: '#f59e0b',
  },
};

// ─── OKLCH scale lightness stops ─────────────────────────────────────────────
//
// Best practice: interpolate only the Lightness channel in OKLCH space.
// Chroma and Hue are held constant from the base color to preserve its identity.
//
//   50  → near-white  (L≈0.97)
//   500 → overridden to the base color's actual L at generation time
//   950 → near-black  (L≈0.11)
//
// Surface uses the same stops but with ~15% chroma for a subtle neutral tint.

const lightnessStops: Record<ColorScale, number> = {
  100: 0.94,
  200: 0.88,
  300: 0.8,
  400: 0.7,
  50: 0.97,
  500: 0.55,
  600: 0.44,
  700: 0.36,
  800: 0.27,
  900: 0.18,
  950: 0.11,
};

// ─── OKLCH converters ─────────────────────────────────────────────────────────

const toOklch = converter('oklch');
const toRgb = converter('rgb');

/**
 * Parse any CSS color string and return it as an Oklch object.
 * Throws if the color string is unrecognisable.
 */
const parseToOklch = (color: string): Oklch => {
  const parsed = parse(color);
  if (parsed === undefined) {
    throw new Error(`Cannot parse color: "${color}"`);
  }
  return toOklch(parsed);
};

/**
 * Convert an Oklch color to a clamped "r, g, b" CSS variable tuple string.
 * Clamps chroma to ensure the color is in the sRGB gamut.
 */
const oklchToRgbTuple = (oklchColor: Oklch): string => {
  const clamped = clampChroma(oklchColor, 'oklch');
  const rgb = toRgb(clamped);
  const red = Math.round(rgb.r * 255);
  const green = Math.round(rgb.g * 255);
  const blue = Math.round(rgb.b * 255);
  return `${red}, ${green}, ${blue}`;
};

/**
 * Build an Oklch color object with explicit fields.
 */
const makeOklch = (l: number, c: number, h: number): Oklch => ({
  c,
  h,
  l,
  mode: 'oklch',
});

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns the lightness stops record. The `isSurface` param is kept for back-compat. */

const getLightnessStops = () =>
  Object.keys(lightnessStops).toSorted((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

/**
 * Generate a perceptually uniform OKLCH color scale for a given CSS color.
 *
 * Only Lightness is interpolated across the scale; Chroma and Hue are constant,
 * so the hue identity of the base color is preserved at every stop.
 *
 * For surface colors, chroma is reduced to ~15% to produce a subtle neutral tint.
 */
const generateColorScale = (hex: string, prefix: string, isSurface = false): string => {
  const base = parseToOklch(hex);
  const baseL = base.l;
  const baseC = base.c;
  const baseH = base.h ?? 0;
  const scaleChroma = isSurface ? baseC * 0.15 : baseC;

  return Object.entries(lightnessStops)
    .toSorted(([stopA], [stopB]) => Number.parseInt(stopA, 10) - Number.parseInt(stopB, 10))
    .map(([stop, targetL]) => {
      const lightness = stop === '500' ? baseL : targetL;
      return `  --${classPrefix}-${prefix}-${stop}: ${oklchToRgbTuple(makeOklch(lightness, scaleChroma, baseH))};`;
    })
    .join('\n');
};

/**
 * Build a UnoCSS-compatible theme colors object that references CSS variables.
 */
const getThemeColors = (prefix: string): Record<string, string> =>
  Object.keys(lightnessStops)
    .toSorted((stopA, stopB) => Number.parseInt(stopA, 10) - Number.parseInt(stopB, 10))
    .reduce<Record<string, string>>((acc, stop) => {
      acc[stop] = `rgb(var(--${classPrefix}-${prefix}-${stop}))`;
      return acc;
    }, {});

const getThemes = () => ({
  colors: {
    accent: getThemeColors('accent'),
    adaptive: {
      bg: `rgb(var(--${classPrefix}-color-bg))`,
      'bg-alt': `rgb(var(--${classPrefix}-color-bg-alt))`,
      border: `var(--${classPrefix}-color-border)`,
      'border-alt': `var(--${classPrefix}-color-border-alt)`,
      inverse: `var(--${classPrefix}-color-inverse)`,
      text: `rgb(var(--${classPrefix}-color-text))`,
      'text-alt': `rgb(var(--${classPrefix}-color-text-alt))`,
      'text-muted': `var(--${classPrefix}-color-text-muted)`,
      'text-muted-alt': `var(--${classPrefix}-color-text-muted-alt)`,
    },
    danger: getThemeColors('danger'),
    info: getThemeColors('info'),
    primary: getThemeColors('primary'),
    success: getThemeColors('success'),
    surface: getThemeColors('surface'),
    warning: getThemeColors('warning'),
  },
});

const generateThemeCss = (className: string, colors: ThemeColors): string => {
  const primaryBase = parseToOklch(colors.primary);
  const accentBase = parseToOklch(colors.accent);
  const dangerBase = parseToOklch(colors.danger);
  const successBase = parseToOklch(colors.success);
  const warningBase = parseToOklch(colors.warning);
  const infoBase = parseToOklch(colors.info);

  const surfaceHex =
    colors.surface !== undefined && colors.surface !== '' ? colors.surface : '#000000';
  const surfaceBase = parseToOklch(surfaceHex);

  const primaryRgb = oklchToRgbTuple(primaryBase);
  const accentRgb = oklchToRgbTuple(accentBase);
  const dangerRgb = oklchToRgbTuple(dangerBase);
  const successRgb = oklchToRgbTuple(successBase);
  const warningRgb = oklchToRgbTuple(warningBase);
  const infoRgb = oklchToRgbTuple(infoBase);
  const surfaceRgb = oklchToRgbTuple(surfaceBase);

  const primaryScale = generateColorScale(colors.primary, 'primary');
  const accentScale = generateColorScale(colors.accent, 'accent');
  const dangerScale = generateColorScale(colors.danger, 'danger');
  const successScale = generateColorScale(colors.success, 'success');
  const warningScale = generateColorScale(colors.warning, 'warning');
  const infoScale = generateColorScale(colors.info, 'info');
  const surfaceScale = generateColorScale(surfaceHex, 'surface', true);

  const selector = className === 'default' ? ':root' : `.${className}`;

  const css = `
${selector} {
  --${classPrefix}-primary-base: ${primaryRgb};
${primaryScale}
  --${classPrefix}-accent-base: ${accentRgb};
${accentScale}
  --${classPrefix}-danger-base: ${dangerRgb};
${dangerScale}
  --${classPrefix}-success-base: ${successRgb};
${successScale}
  --${classPrefix}-warning-base: ${warningRgb};
${warningScale}
  --${classPrefix}-info-base: ${infoRgb};
${infoScale}
  --${classPrefix}-surface-base: ${surfaceRgb};
${surfaceScale}
}`;

  return css;
};

const getCSS = (): string => {
  const themeBlocks = Object.entries(themes)
    .map(([name, colors]) => generateThemeCss(name, colors))
    .join('\n');

  const css = `
${themeBlocks}

:root {
  color-scheme: light dark;
}

/* ── Adaptive & Inverse semantic tokens ── */

/* Light mode: light backgrounds, dark text */
.light {
  color-scheme: light;
  --${classPrefix}-color-bg:              rgb(var(--${classPrefix}-primary-100));
  --${classPrefix}-color-bg-alt:          rgb(var(--${classPrefix}-primary-200));
  --${classPrefix}-color-text:            rgb(var(--${classPrefix}-surface-900));
  --${classPrefix}-color-text-alt:        rgb(var(--${classPrefix}-surface-800));
  --${classPrefix}-color-text-muted:      rgba(var(--${classPrefix}-surface-900), 0.6);
  --${classPrefix}-color-text-muted-alt:  rgba(var(--${classPrefix}-surface-800), 0.6);
  --${classPrefix}-color-border:          rgba(var(--${classPrefix}-surface-900), 0.1);
  --${classPrefix}-color-border-alt:      rgba(var(--${classPrefix}-surface-800), 0.1);
  --${classPrefix}-color-inverse:         rgb(var(--${classPrefix}-surface-950));
}

/* Dark mode: dark backgrounds, light text */
.dark {
  color-scheme: dark;
  --${classPrefix}-color-bg:              rgb(var(--${classPrefix}-primary-900));
  --${classPrefix}-color-bg-alt:          rgb(var(--${classPrefix}-primary-800));
  --${classPrefix}-color-text:            rgb(var(--${classPrefix}-surface-50));
  --${classPrefix}-color-text-alt:        rgb(var(--${classPrefix}-surface-100));
  --${classPrefix}-color-text-muted:      rgba(var(--${classPrefix}-surface-50), 0.6);
  --${classPrefix}-color-text-muted-alt:  rgba(var(--${classPrefix}-surface-100), 0.6);
  --${classPrefix}-color-border:          rgba(var(--${classPrefix}-surface-50), 0.1);
  --${classPrefix}-color-border-alt:      rgba(var(--${classPrefix}-surface-100), 0.1);
  --${classPrefix}-color-inverse:         rgb(var(--${classPrefix}-surface-50));
}

:root, body {
  -webkit-font-smoothing: antialiased;
}

:root {
  color-scheme: light dark;
  background-color: var(--${classPrefix}-color-bg);
  color: var(--${classPrefix}-color-text);
  transition: background-color 0.5s ease, color 0.5s ease;
}`;

  return css;
};

export type { ThemeColors, ColorScale };
export {
  themes,
  lightnessStops,
  getLightnessStops,
  toOklch,
  toRgb,
  parseToOklch,
  oklchToRgbTuple,
  makeOklch,
  generateColorScale,
  getThemeColors,
  getThemes,
  generateThemeCss,
  getCSS,
};
