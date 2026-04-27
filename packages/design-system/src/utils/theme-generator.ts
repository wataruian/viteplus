import { type Oklch, clampChroma, converter, parse } from 'culori';
import { classPrefix } from './helpers';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ThemeColors {
  accent: string;
  danger?: string | undefined;
  info?: string | undefined;
  primary: string;
  success?: string | undefined;
  surface?: string | undefined;
  warning?: string | undefined;
}

type ColorScale = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

// ─── Colors ──────────────────────────────────────────────────────────────────

const danger = '#ef4444';
const info = '#3b82f6';
const success = '#10b981';
const surface = '#000000';
const warning = '#f59e0b';

// ─── Themes ──────────────────────────────────────────────────────────────────

const themes: Record<string, ThemeColors> = {
  default: {
    accent: '#10b981',
    primary: '#8b5cf6',
  },
  emerald: {
    accent: '#3b82f6',
    primary: '#10b981',
  },
  ocean: {
    accent: '#8b5cf6',
    primary: '#0ea5e9',
  },
  sunset: {
    accent: '#f59e0b',
    primary: '#f43f5e',
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
  return `${red} ${green} ${blue}`;
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
const getThemeColors = (prefix: string): Record<string, string> => {
  const colors = Object.keys(lightnessStops)
    .toSorted((stopA, stopB) => Number.parseInt(stopA, 10) - Number.parseInt(stopB, 10))
    .reduce<Record<string, string>>((acc, stop) => {
      acc[stop] = `rgb(var(--${classPrefix}-${prefix}-${stop}) / <alpha-value>)`;
      return acc;
    }, {});

  return {
    ...colors,
    DEFAULT: `rgb(var(--${classPrefix}-${prefix}-base))`,
  };
};

const getThemes = () => ({
  colors: {
    accent: getThemeColors('accent'),
    adaptive: {
      accent: `rgb(var(--${classPrefix}-adaptive-accent) / <alpha-value>)`,
      danger: `rgb(var(--${classPrefix}-adaptive-danger) / <alpha-value>)`,
      info: `rgb(var(--${classPrefix}-adaptive-info) / <alpha-value>)`,
      primary: `rgb(var(--${classPrefix}-adaptive-primary) / <alpha-value>)`,
      success: `rgb(var(--${classPrefix}-adaptive-success) / <alpha-value>)`,
      surface: `rgb(var(--${classPrefix}-adaptive-surface) / <alpha-value>)`,
      warning: `rgb(var(--${classPrefix}-adaptive-warning) / <alpha-value>)`,
    },
    danger: getThemeColors('danger'),
    info: getThemeColors('info'),
    inverse: {
      accent: `rgb(var(--${classPrefix}-inverse-accent) / <alpha-value>)`,
      danger: `rgb(var(--${classPrefix}-inverse-danger) / <alpha-value>)`,
      info: `rgb(var(--${classPrefix}-inverse-info) / <alpha-value>)`,
      primary: `rgb(var(--${classPrefix}-inverse-primary) / <alpha-value>)`,
      success: `rgb(var(--${classPrefix}-inverse-success) / <alpha-value>)`,
      surface: `rgb(var(--${classPrefix}-inverse-surface) / <alpha-value>)`,
      warning: `rgb(var(--${classPrefix}-inverse-warning) / <alpha-value>)`,
    },
    primary: getThemeColors('primary'),
    success: getThemeColors('success'),
    surface: getThemeColors('surface'),
    warning: getThemeColors('warning'),
  },
});

const generateThemeCss = (className: string, colors: ThemeColors): string => {
  const primaryHex = colors.primary;

  if (!primaryHex) {
    throw new Error('Primary color is required');
  }

  const primaryBase = parseToOklch(primaryHex);

  const accentHex = colors.accent;

  if (!accentHex) {
    throw new Error('Accent color is required');
  }

  const accentBase = parseToOklch(accentHex);

  const dangerHex = colors.danger !== undefined && colors.danger !== '' ? colors.danger : danger;
  const dangerBase = parseToOklch(dangerHex);

  const successHex =
    colors.success !== undefined && colors.success !== '' ? colors.success : success;
  const successBase = parseToOklch(successHex);

  const warningHex =
    colors.warning !== undefined && colors.warning !== '' ? colors.warning : warning;
  const warningBase = parseToOklch(warningHex);

  const infoHex = colors.info !== undefined && colors.info !== '' ? colors.info : info;
  const infoBase = parseToOklch(infoHex);

  const surfaceHex =
    colors.surface !== undefined && colors.surface !== '' ? colors.surface : surface;
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
  const dangerScale = generateColorScale(dangerHex, 'danger');
  const successScale = generateColorScale(successHex, 'success');
  const warningScale = generateColorScale(warningHex, 'warning');
  const infoScale = generateColorScale(infoHex, 'info');
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
  --${classPrefix}-adaptive-primary: var(--${classPrefix}-primary-100); 
  --${classPrefix}-inverse-primary: var(--${classPrefix}-primary-900); 
  --${classPrefix}-adaptive-accent: var(--${classPrefix}-accent-100); 
  --${classPrefix}-inverse-accent: var(--${classPrefix}-accent-900); 
  --${classPrefix}-adaptive-danger: var(--${classPrefix}-danger-100); 
  --${classPrefix}-inverse-danger: var(--${classPrefix}-danger-900); 
  --${classPrefix}-adaptive-success: var(--${classPrefix}-success-100); 
  --${classPrefix}-inverse-success: var(--${classPrefix}-success-900); 
  --${classPrefix}-adaptive-warning: var(--${classPrefix}-warning-100); 
  --${classPrefix}-inverse-warning: var(--${classPrefix}-warning-900); 
  --${classPrefix}-adaptive-info: var(--${classPrefix}-info-100); 
  --${classPrefix}-inverse-info: var(--${classPrefix}-info-900); 
  --${classPrefix}-adaptive-surface: var(--${classPrefix}-surface-100); 
  --${classPrefix}-inverse-surface: var(--${classPrefix}-surface-900); 
}

/* Dark mode: dark backgrounds, light text */
.dark {
  color-scheme: dark;
  --${classPrefix}-adaptive-primary: var(--${classPrefix}-primary-900);
  --${classPrefix}-inverse-primary: var(--${classPrefix}-primary-100); 
  --${classPrefix}-adaptive-accent: var(--${classPrefix}-accent-900); 
  --${classPrefix}-inverse-accent: var(--${classPrefix}-accent-100); 
  --${classPrefix}-adaptive-danger: var(--${classPrefix}-danger-900); 
  --${classPrefix}-inverse-danger: var(--${classPrefix}-danger-100); 
  --${classPrefix}-adaptive-success: var(--${classPrefix}-success-900); 
  --${classPrefix}-inverse-success: var(--${classPrefix}-success-100); 
  --${classPrefix}-adaptive-warning: var(--${classPrefix}-warning-900); 
  --${classPrefix}-inverse-warning: var(--${classPrefix}-warning-100); 
  --${classPrefix}-adaptive-info: var(--${classPrefix}-info-900); 
  --${classPrefix}-inverse-info: var(--${classPrefix}-info-100); 
  --${classPrefix}-adaptive-surface: var(--${classPrefix}-surface-900); 
  --${classPrefix}-inverse-surface: var(--${classPrefix}-surface-100); 
}

:root, body {
  -webkit-font-smoothing: antialiased;
}

:root {
  color-scheme: light dark;
  background-color: rgb(var(--${classPrefix}-adaptive-primary));
  color: rgb(var(--${classPrefix}-inverse-surface));
  transition: background-color 0.5s ease, color 0.5s ease;
}`;

  return css;
};

export type { ThemeColors, ColorScale };
export {
  danger,
  warning,
  info,
  success,
  surface,
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
