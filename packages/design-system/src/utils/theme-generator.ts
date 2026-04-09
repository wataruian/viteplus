import { type Oklch, clampChroma, converter, parse } from 'culori';

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
  // Keep numeric ascending order
  /* eslint-disable sort-keys */
  50: 0.97,
  100: 0.94,
  200: 0.88,
  300: 0.8,
  400: 0.7,
  500: 0.55, // identity stop — overridden per-color in generateColorScale
  600: 0.44,
  700: 0.36,
  800: 0.27,
  900: 0.18,
  950: 0.11,
  /* eslint-enable sort-keys */
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
// eslint-disable-next-line id-length
const makeOklch = (lightness: number, chroma: number, hue: number): Oklch => ({
  // OKLCH spec uses single-char field names: c (chroma), h (hue), l (lightness)
  /* eslint-disable id-length */
  c: chroma,
  h: hue,
  l: lightness,
  /* eslint-enable id-length */
  mode: 'oklch',
});

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns the lightness stops record. The `isSurface` param is kept for back-compat. */
const getWeights = (_isSurface = false): Record<ColorScale, number> => lightnessStops;

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
      return `  --${prefix}-${stop}: ${oklchToRgbTuple(makeOklch(lightness, scaleChroma, baseH))};`;
    })
    .join('\n');
};

/**
 * Build a UnoCSS-compatible theme colors object that references CSS variables.
 */
const getThemeColors = (prefix: string): Record<string, string> => {
  const colors = Object.keys(lightnessStops).reduce<Record<string, string>>((acc, stop) => {
    acc[stop] = `rgb(var(--${prefix}-${stop}))`;
    return acc;
  }, {});
  colors['DEFAULT'] = `rgb(var(--${prefix}-base))`;
  return colors;
};

const getThemes = () => ({
  colors: {
    accent: getThemeColors('accent'),
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

  return `
${selector} {
  --primary-base: ${primaryRgb};
${primaryScale}
  --accent-base: ${accentRgb};
${accentScale}
  --danger-base: ${dangerRgb};
${dangerScale}
  --success-base: ${successRgb};
${successScale}
  --warning-base: ${warningRgb};
${warningScale}
  --info-base: ${infoRgb};
${infoScale}
  --surface-base: ${surfaceRgb};
${surfaceScale}
}`;
};

const getCSS = (): string => {
  const themeBlocks = Object.entries(themes)
    .map(([name, colors]) => generateThemeCss(name, colors))
    .join('\n');

  return `
${themeBlocks}

:root {
  color-scheme: light dark;
}

/* ── Adaptive & Inverse semantic tokens ── */

/* Light mode: light backgrounds, dark text */
.light {
  color-scheme: light;

  --color-bg:         rgb(var(--surface-50));
  --color-bg-alt:     rgb(var(--surface-100));
  --color-text:       rgb(var(--surface-900));
  --color-text-muted: rgba(var(--surface-900), 0.6);
  --color-border:     rgba(var(--surface-900), 0.1);
  --color-inverse:    rgb(var(--surface-950));
}

/* Dark mode: dark backgrounds, light text */
.dark {
  color-scheme: dark;

  --color-bg:         rgb(var(--surface-950));
  --color-bg-alt:     rgb(var(--surface-900));
  --color-text:       rgb(var(--surface-50));
  --color-text-muted: rgba(var(--surface-50), 0.6);
  --color-border:     rgba(var(--surface-50), 0.1);
  --color-inverse:    rgb(var(--surface-50));
}

:root, body {
  -webkit-font-smoothing: antialiased;
}`;
};

export type { ThemeColors, ColorScale };
export {
  themes,
  lightnessStops,
  toOklch,
  toRgb,
  parseToOklch,
  oklchToRgbTuple,
  makeOklch,
  getWeights,
  generateColorScale,
  getThemeColors,
  getThemes,
  generateThemeCss,
  getCSS,
};
