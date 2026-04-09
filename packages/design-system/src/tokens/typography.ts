import type { WebFontsOptions } from 'unocss/preset-web-fonts';

/**
 * Typography Tokens
 *
 * Defines font families, sizes, and weights for the design system.
 */

const fonts = {
  header: 'Outfit, sans-serif',
  mono: 'Fira Code, monospace',
  sans: 'Inter, sans-serif',
} as const;

const fontSizes = {
  '2xl': '1.5rem', // 24px
  '3xl': '1.875rem', // 30px
  '4xl': '2.25rem', // 36px
  '5xl': '3rem', // 48px
  '6xl': '3.75rem', // 60px
  '7xl': '4.5rem', // 72px
  '8xl': '6rem', // 96px
  base: '1rem', // 16px
  lg: '1.125rem', // 18px
  liquidDisplay: 'text-[min(120px,12vw)]',
  sm: '0.875rem', // 14px
  textBody: '1rem', // 16px
  textCaption: '0.75rem', // 12px
  textDisplay: '6rem', // 96px
  textHeadline: '2.25rem', // 36px
  textSubheadline: '1.5rem', // 24px
  xl: '1.25rem', // 20px
  xs: '0.75rem', // 12px
} as const;

const fontWeights = {
  black: '900',
  bold: '700',
  extrabold: '800',
  light: '300',
  medium: '500',
  normal: '400',
  semibold: '600',
} as const;

const letterSpacings = {
  normal: '0em',
  tight: '-0.025em',
  tighter: '-0.05em',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

const lineHeights = {
  compressed: '0.8',
  loose: '2',
  none: '1',
  normal: '1.5',
  relaxed: '1.625',
  snug: '1.375',
  tight: '1.25',
} as const;

const webFontsOptions: WebFontsOptions = {
  fonts: {
    header: 'Outfit:400,600,700,800',
    mono: 'Fira Code',
    sans: 'Inter:300,400,500,600,700',
  },
};

export { fonts, fontSizes, fontWeights, letterSpacings, lineHeights, webFontsOptions };
