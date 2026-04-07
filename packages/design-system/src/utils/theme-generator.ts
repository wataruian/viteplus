export interface ThemeColors {
  accent: string;
  primary: string;
  surface?: string;
}

export type ColorScale = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

export const themes: Record<string, ThemeColors> = {
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

/**
 * Converts a hex color string to an RGB tuple.
 */
export const hexToRgb = (hex: string): [number, number, number] => {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const red = Number.parseInt(cleanHex.slice(0, 1).repeat(2), 16);
    const green = Number.parseInt(cleanHex.slice(1, 2).repeat(2), 16);
    const blue = Number.parseInt(cleanHex.slice(2, 3).repeat(2), 16);
    return [red, green, blue];
  }
  const red = Number.parseInt(cleanHex.slice(0, 2), 16);
  const green = Number.parseInt(cleanHex.slice(2, 4), 16);
  const blue = Number.parseInt(cleanHex.slice(4, 6), 16);
  return [red, green, blue];
};

export const adjust = (val: number, amt: number) => {
  if (amt >= 0) {
    // Tint: Interpolate towards white (255)
    return Math.floor(val + (255 - val) * amt);
  }
  // Shade base is always black (0), so interpolate towards 0
  // amount is negative here, e.g. -0.2
  return Math.floor(val + val * amt);
};

/**
 * Simplistic HSL to RGB conversion for basic color variance.
 */
export const adjustColor = (hex: string, amount: number): string => {
  const [red, green, blue] = hexToRgb(hex);
  const newRed = adjust(red, amount);
  const newGreen = adjust(green, amount);
  const newBlue = adjust(blue, amount);
  return `${newRed}, ${newGreen}, ${newBlue}`;
};

export const getWeights = (isSurface = false) => {
  const weights: Record<ColorScale, number> = isSurface
    ? {
        100: 0.9,
        200: 0.8,
        300: 0.7,
        400: 0.6,
        50: 0.95,
        500: 0.5,
        600: 0.4,
        700: 0.3,
        800: 0.2,
        900: 0.1,
        950: 0,
      }
    : {
        100: 0.9,
        200: 0.8,
        300: 0.6,
        400: 0.4,
        50: 0.95,
        500: 0,
        600: -0.2,
        700: -0.4,
        800: -0.6,
        900: -0.8,
        950: -0.9,
      };

  return weights;
};

export const getThemeColors = (prefix: string) => {
  const weights = getWeights();
  const colors = Object.entries(weights).reduce<Record<string, string>>((acc, [stop]) => {
    acc[stop] = `rgb(var(--${prefix}-${stop}))`;
    return acc;
  }, {});
  colors['DEFAULT'] = `rgb(var(--${prefix}-base))`;
  return colors;
};

export const getThemes = () => ({
  colors: {
    accent: getThemeColors('accent'),
    adaptive: {
      accent: 'var(--accent-adaptive)',
      bg: 'var(--primary-adaptive)',
      surface: 'var(--surface-adaptive)',
    },
    primary: getThemeColors('primary'),
    surface: getThemeColors('surface'),
  },
});

/**
 * Generates a full color scale (50-950) from a base hex color.
 */
export const generateColorScale = (hex: string, prefix: string, isSurface = false): string => {
  const weights = getWeights(isSurface);

  return Object.entries(weights)
    .toSorted(([shadeA], [shadeB]) => Number.parseInt(shadeA, 10) - Number.parseInt(shadeB, 10))
    .map(([stop, amount]) => `  --${prefix}-${stop}: ${adjustColor(hex, amount)};`)
    .join('\n');
};

/**
 * Generates CSS variables for a theme class.
 */
export const generateThemeCss = (className: string, colors: ThemeColors): string => {
  const primaryScale = generateColorScale(colors.primary, 'primary');

  const accentScale = generateColorScale(colors.accent, 'accent');

  const surfaceBase =
    colors.surface !== undefined && colors.surface !== '' ? colors.surface : '#000000';
  const surfaceScale = generateColorScale(surfaceBase, 'surface', true);

  const selector = className === 'default' ? ':root' : `.${className}`;

  const css = `
${selector} {
  --primary-base: ${hexToRgb(colors.primary).join(', ')};
${primaryScale}
  --accent-base: ${hexToRgb(colors.accent).join(', ')};
${accentScale}
  --surface-base: ${hexToRgb(surfaceBase).join(', ')};
${surfaceScale}
}`;

  return css;
};

export const getCSS = () => {
  const css = `
${Object.entries(themes)
  .map(([className, colors]) => generateThemeCss(className, colors))
  .join('\n')}

:root {
  color-scheme: light dark;
}

.light {
  color-scheme: light;

  --primary-adaptive: rgb(var(--primary-50));
  --primary-inverse: rgb(var(--primary-950));

  --accent-adaptive: rgb(var(--accent-50));
  --accent-inverse: rgb(var(--accent-950));

  --surface-adaptive: rgb(var(--surface-950));
  --surface-inverse: rgb(var(--surface-50));
}

.dark {
  color-scheme: dark;

  --primary-adaptive: rgb(var(--primary-950));
  --primary-inverse: rgb(var(--primary-50));

  --accent-adaptive: rgb(var(--accent-950));
  --accent-inverse: rgb(var(--accent-50));

  --surface-adaptive: rgb(var(--surface-50));
  --surface-inverse: rgb(var(--surface-950));
}

:root, body {
  -webkit-font-smoothing: antialiased;
}`;

  return css;
};
