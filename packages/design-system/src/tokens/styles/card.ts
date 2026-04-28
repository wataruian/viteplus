import { baseStyles } from './base';

const cardStyles = {
  base: 'rounded-2xl overflow-hidden transition-all duration-300 p-6',
  default: {
    intent: 'primary' as const,
  },
  variants: {
    intent: {
      glass: `${baseStyles.colors.bg.adaptiveSurface}/40 backdrop-blur-xl shadow-2xl`,
      outline: `${baseStyles.colors.bg.transparent} shadow-sm ring-1 ${baseStyles.colors.ring.inverseSurface}/10`,
      premium: `${baseStyles.colors.bg.adaptiveSurface} shadow-2xl ${baseStyles.colors.shadow.primary}/20 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/10 before:via-transparent before:to-accent/5 hover:scale-[1.01] ring-1 ${baseStyles.colors.ring.primary}/30`,
      primary: `${baseStyles.colors.bg.adaptivePrimary} shadow-lg shadow-adaptive-primary/20`,
    },
  },
} as const;

export { cardStyles };
