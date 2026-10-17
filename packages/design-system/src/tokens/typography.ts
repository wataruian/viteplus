import type { WebFontsOptions } from 'unocss/preset-web-fonts';

const fonts = {
  header: 'Outfit, sans-serif',
  mono: 'Fira Code, monospace',
  sans: 'Inter, sans-serif',
} as const;

const fontSizes = {
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
  '6xl': '3.75rem',
  '7xl': '4.5rem',
  '8xl': '6rem',
  base: '1rem',
  lg: '1.125rem',
  liquidDisplay: 'min(7.5rem, 12vw)',
  sm: '0.875rem',
  textBody: '1rem',
  textCaption: '0.75rem',
  textDisplay: '6rem',
  textHeadline: '2.25rem',
  textSubHeadline: '1.5rem',
  xl: '1.25rem',
  xs: '0.75rem',
} as const;

const fontWeights = {
  black: '900',
  bold: '700',
  extraBold: '800',
  light: '300',
  medium: '500',
  normal: '400',
  semiBold: '600',
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
