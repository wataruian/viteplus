import { buttonStyles } from './button';

const modeSwitcherStyles = {
  base: 'aspect-square flex items-center justify-center !p-0',
  default: {
    intent: 'ghost' as const,
    look: 'default' as const,
    size: 'md' as const,
  },
  variants: {
    intent: buttonStyles.variants.intent,
    look: {
      default: {
        moonIcon: 'i-ph-moon-bold',
        sunIcon: 'i-ph-sun-bold',
      },
    },
    size: buttonStyles.variants.size,
  },
} as const;

export { modeSwitcherStyles };
