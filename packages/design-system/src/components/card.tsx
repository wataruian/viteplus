import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from './base';
import { baseStyles } from '../tokens/base';

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

const cardVariants = cva(cardStyles.base, {
  defaultVariants: cardStyles.default,
  variants: cardStyles.variants,
});

type CardVariants = VariantProps<typeof cardVariants>;

interface CardProps extends BaseComponentProps<HTMLAttributes<HTMLDivElement>>, CardVariants {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', intent, props, useDefault = true }, ref) => {
    const finalClass = useDefault ? cardVariants({ className, intent }) : className;

    return (
      <div {...props} ref={ref} className={finalClass}>
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

export type { CardProps, CardVariants };
export { Card, cardStyles };
