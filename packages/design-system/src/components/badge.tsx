import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { badgeStyles } from '../tokens/styles';

const badgeVariants = cva(badgeStyles.base, {
  defaultVariants: badgeStyles.default,
  variants: badgeStyles.variants,
});

type BadgeVariants = VariantProps<typeof badgeVariants>;

interface BadgeProps extends BaseComponentProps<HTMLAttributes<HTMLSpanElement>>, BadgeVariants {}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, className = '', intent, props, size, useDefault = true }, ref) => {
    const finalClass = useDefault ? badgeVariants({ className, intent, size }) : className;

    return (
      <span {...props} ref={ref} className={finalClass}>
        {children}
      </span>
    );
  },
);

Badge.displayName = 'Badge';

export type { BadgeProps, BadgeVariants };
export { Badge, badgeVariants };
