// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
type Breakpoint = Record<keyof typeof breakpoints, string>;

// ----------------------------------------------------------------------------
// TOKENS
// ----------------------------------------------------------------------------
const breakpoints = {
  '2xl': '1536px',
  base: '0px', // Add base breakpoint
  lg: '1024px',
  md: '768px',
  sm: '640px',
  xl: '1280px',
} as const;

const mediaQueries: Breakpoint = {
  '2xl': `@media (min-width: ${breakpoints['2xl']})`,
  base: '', // Base doesn't need in media query
  lg: `@media (min-width: ${breakpoints.lg})`,
  md: `@media (min-width: ${breakpoints.md})`,
  sm: `@media (min-width: ${breakpoints.sm})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
} as const;

const tokens = {
  breakpoints,
  mediaQueries,
};

export type { Breakpoint };
export { breakpoints, mediaQueries, tokens };
