import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { cardStyles } from '../tokens/styles';

const cardVariants = cva(cardStyles.base, {
  defaultVariants: cardStyles.default,
  variants: cardStyles.variants,
});

type CardVariants = VariantProps<typeof cardVariants>;

interface CardProps extends BaseComponentProps<HTMLAttributes<HTMLDivElement>>, CardVariants {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', intent, props, useDefault = false }, ref) => {
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
export { Card, cardVariants };
