import { baseStyles } from './base';

const logoStyles = {
  base: 'flex items-center gap-2 font-black',
  default: {
    look: 'default' as const,
  },
  variants: {
    look: {
      default: {
        bottom: 'text-2xl tracking-tighter text-white',
        inner: 'flex flex-col items-start leading-compressed',
        top: baseStyles.colors.text.primary,
      },
    },
  },
} as const;

export { logoStyles };
