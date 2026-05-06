// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
type FontFamily = keyof (typeof typographyTokens)['fontFamily'];
type FontSize = keyof (typeof typographyTokens)['fontSize'];
type FontWeight = keyof (typeof typographyTokens)['fontWeight'];
type LineHeight = keyof (typeof typographyTokens)['lineHeight'];
interface Typography {
  fontFamily: Record<FontFamily, string>;
  fontSize: Record<FontSize, string>;
  fontWeight: Record<FontWeight, string>;
  lineHeight: Record<LineHeight, string>;
}

// ----------------------------------------------------------------------------
// TOKENS
// ----------------------------------------------------------------------------
const typographyTokens = {
  fontFamily: {
    mono: 'JetBrains Mono, monospace',
    sans: 'Inter, system-ui, -apple-system, sans-serif',
  } as const,
  fontSize: {
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    base: '1rem',
    lg: '1.125rem',
    sm: '0.875rem',
    xl: '1.25rem',
    xs: '0.75rem',
  } as const,
  fontWeight: {
    bold: '700',
    light: '300',
    medium: '500',
    normal: '400',
    semibold: '600',
  } as const,
  lineHeight: {
    loose: '2',
    none: '1',
    normal: '1.5',
    relaxed: '1.625',
    snug: '1.375',
    tight: '1.25',
  } as const,
};

const tokens = {
  typographyTokens,
};

export type { FontFamily, FontSize, FontWeight, LineHeight, Typography };
export { tokens, typographyTokens };
