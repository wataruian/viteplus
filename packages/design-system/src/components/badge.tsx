import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import type { HTMLAttributes } from 'react';
import { badgeStyles } from '../tokens/variants';
import { getSlotClass } from '../utils/styles';

const badgeVariants = cva(badgeStyles.base, {
  defaultVariants: badgeStyles.defaultVariants,
  variants: badgeStyles.variants,
});

type BadgeVariants = VariantProps<typeof badgeVariants>;

interface BadgeProps extends BaseComponentProps<HTMLAttributes<HTMLSpanElement>>, BadgeVariants {}

const Badge = ({
  children,
  className = '',
  intent,
  props,
  size,
  useDefault = true,
}: BadgeProps) => {
  const finalClass = useDefault ? badgeVariants({ className, intent, size }) : className;

  return (
    <span {...props} className={getSlotClass(useDefault, finalClass, props)}>
      {children}
    </span>
  );
};

export type { BadgeProps, BadgeVariants };
export { Badge, badgeVariants };
