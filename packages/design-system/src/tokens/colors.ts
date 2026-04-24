/**
 * Color Tokens
 *
 * Defines the semantic color palette and functional color mappings.
 * All colors use OKLCH for perceptual uniformity and better theme adaptation.
 */

import { classPrefix } from '../utils/helpers';

type ColorKey = 'primary' | 'accent' | 'surface' | 'success' | 'warning' | 'danger' | 'info';

const colorPalettes: ColorKey[] = [
  'primary',
  'accent',
  'surface',
  'success',
  'warning',
  'danger',
  'info',
];

const colors = {
  accent: {
    '100': `rgb(var(--${classPrefix}-accent-100))`,
    '200': `rgb(var(--${classPrefix}-accent-200))`,
    '300': `rgb(var(--${classPrefix}-accent-300))`,
    '400': `rgb(var(--${classPrefix}-accent-400))`,
    '50': `rgb(var(--${classPrefix}-accent-50))`,
    '500': `rgb(var(--${classPrefix}-accent-500))`,
    '600': `rgb(var(--${classPrefix}-accent-600))`,
    '700': `rgb(var(--${classPrefix}-accent-700))`,
    '800': `rgb(var(--${classPrefix}-accent-800))`,
    '900': `rgb(var(--${classPrefix}-accent-900))`,
    '950': `rgb(var(--${classPrefix}-accent-950))`,
    base: `rgb(var(--${classPrefix}-accent-base))`,
  },

  danger: {
    '100': `rgb(var(--${classPrefix}-danger-100))`,
    '200': `rgb(var(--${classPrefix}-danger-200))`,
    '300': `rgb(var(--${classPrefix}-danger-300))`,
    '400': `rgb(var(--${classPrefix}-danger-400))`,
    '50': `rgb(var(--${classPrefix}-danger-50))`,
    '500': `rgb(var(--${classPrefix}-danger-500))`,
    '600': `rgb(var(--${classPrefix}-danger-600))`,
    '700': `rgb(var(--${classPrefix}-danger-700))`,
    '800': `rgb(var(--${classPrefix}-danger-800))`,
    '900': `rgb(var(--${classPrefix}-danger-900))`,
    '950': `rgb(var(--${classPrefix}-danger-950))`,
    base: `rgb(var(--${classPrefix}-danger-base))`,
  },

  info: {
    '100': `rgb(var(--${classPrefix}-info-100))`,
    '200': `rgb(var(--${classPrefix}-info-200))`,
    '300': `rgb(var(--${classPrefix}-info-300))`,
    '400': `rgb(var(--${classPrefix}-info-400))`,
    '50': `rgb(var(--${classPrefix}-info-50))`,
    '500': `rgb(var(--${classPrefix}-info-500))`,
    '600': `rgb(var(--${classPrefix}-info-600))`,
    '700': `rgb(var(--${classPrefix}-info-700))`,
    '800': `rgb(var(--${classPrefix}-info-800))`,
    '900': `rgb(var(--${classPrefix}-info-900))`,
    '950': `rgb(var(--${classPrefix}-info-950))`,
    base: `rgb(var(--${classPrefix}-info-base))`,
  },

  primary: {
    '100': `rgb(var(--${classPrefix}-primary-100))`,
    '200': `rgb(var(--${classPrefix}-primary-200))`,
    '300': `rgb(var(--${classPrefix}-primary-300))`,
    '400': `rgb(var(--${classPrefix}-primary-400))`,
    '50': `rgb(var(--${classPrefix}-primary-50))`,
    '500': `rgb(var(--${classPrefix}-primary-500))`,
    '600': `rgb(var(--${classPrefix}-primary-600))`,
    '700': `rgb(var(--${classPrefix}-primary-700))`,
    '800': `rgb(var(--${classPrefix}-primary-800))`,
    '900': `rgb(var(--${classPrefix}-primary-900))`,
    '950': `rgb(var(--${classPrefix}-primary-950))`,
    base: `rgb(var(--${classPrefix}-primary-base))`,
  },

  // ─── Semantic & Adaptive Tokens ───────────────────────────────────────────
  // These tokens flip automatically between light and dark modes
  semantic: {
    bg: `var(--${classPrefix}-bg)`,
    'bg-alt': `var(--${classPrefix}-bg-alt)`,
    border: `var(--${classPrefix}-border)`,
    'content-muted': `var(--${classPrefix}-text-muted)`,
    'content-primary': `var(--${classPrefix}-text)`,
    error: `rgb(var(--${classPrefix}-danger-500))`,
    info: `rgb(var(--${classPrefix}-info-500))`,
    inverse: `var(--${classPrefix}-inverse)`,
    success: `rgb(var(--${classPrefix}-success-500))`,
    warning: `rgb(var(--${classPrefix}-warning-500))`,
  },

  success: {
    '100': `rgb(var(--${classPrefix}-success-100))`,
    '200': `rgb(var(--${classPrefix}-success-200))`,
    '300': `rgb(var(--${classPrefix}-success-300))`,
    '400': `rgb(var(--${classPrefix}-success-400))`,
    '50': `rgb(var(--${classPrefix}-success-50))`,
    '500': `rgb(var(--${classPrefix}-success-500))`,
    '600': `rgb(var(--${classPrefix}-success-600))`,
    '700': `rgb(var(--${classPrefix}-success-700))`,
    '800': `rgb(var(--${classPrefix}-success-800))`,
    '900': `rgb(var(--${classPrefix}-success-900))`,
    '950': `rgb(var(--${classPrefix}-success-950))`,
    base: `rgb(var(--${classPrefix}-success-base))`,
  },

  surface: {
    '100': `rgb(var(--${classPrefix}-surface-100))`,
    '200': `rgb(var(--${classPrefix}-surface-200))`,
    '300': `rgb(var(--${classPrefix}-surface-300))`,
    '400': `rgb(var(--${classPrefix}-surface-400))`,
    '50': `rgb(var(--${classPrefix}-surface-50))`,
    '500': `rgb(var(--${classPrefix}-surface-500))`,
    '600': `rgb(var(--${classPrefix}-surface-600))`,
    '700': `rgb(var(--${classPrefix}-surface-700))`,
    '800': `rgb(var(--${classPrefix}-surface-800))`,
    '900': `rgb(var(--${classPrefix}-surface-900))`,
    '950': `rgb(var(--${classPrefix}-surface-950))`,
    base: `rgb(var(--${classPrefix}-surface-base))`,
  },

  warning: {
    '100': `rgb(var(--${classPrefix}-warning-100))`,
    '200': `rgb(var(--${classPrefix}-warning-200))`,
    '300': `rgb(var(--${classPrefix}-warning-300))`,
    '400': `rgb(var(--${classPrefix}-warning-400))`,
    '50': `rgb(var(--${classPrefix}-warning-50))`,
    '500': `rgb(var(--${classPrefix}-warning-500))`,
    '600': `rgb(var(--${classPrefix}-warning-600))`,
    '700': `rgb(var(--${classPrefix}-warning-700))`,
    '800': `rgb(var(--${classPrefix}-warning-800))`,
    '900': `rgb(var(--${classPrefix}-warning-900))`,
    '950': `rgb(var(--${classPrefix}-warning-950))`,
    base: `rgb(var(--${classPrefix}-warning-base))`,
  },
} as const;

export type { ColorKey };
export { classPrefix, colorPalettes, colors };
