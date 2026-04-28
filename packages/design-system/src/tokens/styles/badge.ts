import { baseStyles, intentSoft } from './base';

const badgeStyles = {
  base: 'inline-flex items-center justify-center font-black uppercase tracking-widest transition-all duration-300 shadow-sm backdrop-blur-sm',
  default: {
    intent: 'primary' as const,
    size: 'md' as const,
  },
  variants: {
    intent: {
      accent: intentSoft('accent'),
      danger: intentSoft('danger'),
      glass: `${baseStyles.colors.bg.adaptiveSurface}/15 ${baseStyles.colors.text.inverseSurface} ring-1 ${baseStyles.colors.ring.adaptiveSurface}/10`,
      info: intentSoft('info'),
      outline: `${baseStyles.colors.bg.transparent} ${baseStyles.colors.text.inverseSurface} ring-1 ${baseStyles.colors.ring.inverseSurface}/10`,
      primary: intentSoft('primary'),
      success: intentSoft('success'),
      warning: intentSoft('warning'),
    },
    size: {
      lg: 'px-4 py-1.5 text-sm rounded-full',
      md: 'px-3 py-1 text-xs rounded-full',
      sm: 'px-2.5 py-0.5 text-[10px] rounded-full',
    },
  },
} as const;

export { badgeStyles };
