import { baseStyles, intentInput } from './base';

const inputStyles = {
  base: `w-full max-w-full box-border min-w-0 ${baseStyles.colors.bg.adaptiveSurface}/50 rounded-xl px-4 py-3 ${baseStyles.colors.text.inverseSurface} placeholder:${baseStyles.colors.text.inverseSurface}/40 transition-all focus:outline-none focus:ring-2 shadow-sm`,
  default: {
    state: 'default' as const,
  },
  variants: {
    state: {
      default: '',
      error: intentInput('danger'),
      success: intentInput('success'),
    },
  },
} as const;

export { inputStyles };
