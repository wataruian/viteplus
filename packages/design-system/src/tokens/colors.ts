/**
 * Color Tokens
 *
 * Defines the semantic color palette and functional color mappings.
 * All colors use OKLCH for perceptual uniformity and better theme adaptation.
 */

const colors = {
  accent: {
    100: 'rgb(var(--accent-100))',
    200: 'rgb(var(--accent-200))',
    300: 'rgb(var(--accent-300))',
    400: 'rgb(var(--accent-400))',
    50: 'rgb(var(--accent-50))',
    500: 'rgb(var(--accent-500))',
    600: 'rgb(var(--accent-600))',
    700: 'rgb(var(--accent-700))',
    800: 'rgb(var(--accent-800))',
    900: 'rgb(var(--accent-900))',
    950: 'rgb(var(--accent-950))',
    base: 'rgb(var(--accent-base))',
  },

  danger: {
    100: 'rgb(var(--danger-100))',
    200: 'rgb(var(--danger-200))',
    300: 'rgb(var(--danger-300))',
    400: 'rgb(var(--danger-400))',
    50: 'rgb(var(--danger-50))',
    500: 'rgb(var(--danger-500))',
    600: 'rgb(var(--danger-600))',
    700: 'rgb(var(--danger-700))',
    800: 'rgb(var(--danger-800))',
    900: 'rgb(var(--danger-900))',
    950: 'rgb(var(--danger-950))',
    base: 'rgb(var(--danger-base))',
  },

  info: {
    100: 'rgb(var(--info-100))',
    200: 'rgb(var(--info-200))',
    300: 'rgb(var(--info-300))',
    400: 'rgb(var(--info-400))',
    50: 'rgb(var(--info-50))',
    500: 'rgb(var(--info-500))',
    600: 'rgb(var(--info-600))',
    700: 'rgb(var(--info-700))',
    800: 'rgb(var(--info-800))',
    900: 'rgb(var(--info-900))',
    950: 'rgb(var(--info-950))',
    base: 'rgb(var(--info-base))',
  },

  primary: {
    100: 'rgb(var(--primary-100))',
    200: 'rgb(var(--primary-200))',
    300: 'rgb(var(--primary-300))',
    400: 'rgb(var(--primary-400))',
    50: 'rgb(var(--primary-50))',
    500: 'rgb(var(--primary-500))',
    600: 'rgb(var(--primary-600))',
    700: 'rgb(var(--primary-700))',
    800: 'rgb(var(--primary-800))',
    900: 'rgb(var(--primary-900))',
    950: 'rgb(var(--primary-950))',
    base: 'rgb(var(--primary-base))',
  },

  // ─── Semantic & Adaptive Tokens ───────────────────────────────────────────
  // These tokens flip automatically between light and dark modes
  semantic: {
    bg: 'var(--color-bg)',
    bgAlt: 'var(--color-bg-alt)',
    border: 'var(--color-border)',
    contentMuted: 'var(--color-text-muted)',
    contentPrimary: 'var(--color-text)',
    error: 'rgb(var(--danger-500))',
    info: 'rgb(var(--info-500))',
    inverse: 'var(--color-inverse)',
    success: 'rgb(var(--success-500))',
    warning: 'rgb(var(--warning-500))',
  },

  success: {
    100: 'rgb(var(--success-100))',
    200: 'rgb(var(--success-200))',
    300: 'rgb(var(--success-300))',
    400: 'rgb(var(--success-400))',
    50: 'rgb(var(--success-50))',
    500: 'rgb(var(--success-500))',
    600: 'rgb(var(--success-600))',
    700: 'rgb(var(--success-700))',
    800: 'rgb(var(--success-800))',
    900: 'rgb(var(--success-900))',
    950: 'rgb(var(--success-950))',
    base: 'rgb(var(--success-base))',
  },

  surface: {
    100: 'rgb(var(--surface-100))',
    200: 'rgb(var(--surface-200))',
    300: 'rgb(var(--surface-300))',
    400: 'rgb(var(--surface-400))',
    50: 'rgb(var(--surface-50))',
    500: 'rgb(var(--surface-500))',
    600: 'rgb(var(--surface-600))',
    700: 'rgb(var(--surface-700))',
    800: 'rgb(var(--surface-800))',
    900: 'rgb(var(--surface-900))',
    950: 'rgb(var(--surface-950))',
    base: 'rgb(var(--surface-base))',
  },

  warning: {
    100: 'rgb(var(--warning-100))',
    200: 'rgb(var(--warning-200))',
    300: 'rgb(var(--warning-300))',
    400: 'rgb(var(--warning-400))',
    50: 'rgb(var(--warning-50))',
    500: 'rgb(var(--warning-500))',
    600: 'rgb(var(--warning-600))',
    700: 'rgb(var(--warning-700))',
    800: 'rgb(var(--warning-800))',
    900: 'rgb(var(--warning-900))',
    950: 'rgb(var(--warning-950))',
    base: 'rgb(var(--warning-base))',
  },
} as const;

export { colors };
