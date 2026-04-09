import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import type { HTMLAttributes } from 'react';
import { cardStyles } from '../tokens/variants';
import { getSlotClass } from '../utils/styles';

const cardVariants = cva(cardStyles.base, {
  defaultVariants: cardStyles.defaultVariants,
  variants: cardStyles.variants,
});

type CardVariants = VariantProps<typeof cardVariants>;

interface CardProps extends BaseComponentProps<HTMLAttributes<HTMLDivElement>>, CardVariants {}

const Card = ({ children, className = '', intent, props, useDefault = true }: CardProps) => {
  const finalClass = useDefault ? cardVariants({ className, intent }) : className;

  return (
    <div {...props} className={getSlotClass(useDefault, finalClass, props)}>
      {children}
    </div>
  );
};

export type { CardProps, CardVariants };
export { Card, cardVariants };
