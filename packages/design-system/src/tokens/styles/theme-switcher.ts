import { baseStyles } from './base';

const themeSwitcherStyles = {
  base: `flex flex-wrap gap-1 ${baseStyles.colors.bg.adaptiveSurface} p-1 rounded-xl border ${baseStyles.colors.border.inverseSurface}/10 shadow-sm w-fit`,
  default: {
    look: 'default' as const,
    plain: false,
    size: 'sm' as const,
  },
  variants: {
    look: {
      default: {
        activeIntent: 'inverse',
        button: 'capitalize font-medium shadow-none transition-colors',
        inactiveIntent: 'ghost',
      },
    },
    plain: {
      false: '',
      true: '!bg-transparent !border-none !shadow-none !p-0',
    },
    size: {
      lg: 'gap-2 p-2',
      md: 'gap-1.5 p-1.5',
      sm: 'gap-1 p-1',
    },
  },
} as const;

export { themeSwitcherStyles };
