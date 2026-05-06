import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';

const iconStyles = {
  base: 'inline-block shrink-0',
  default: {
    size: 'md' as const,
  },
  variants: {
    size: {
      lg: 'w-6 h-6',
      md: 'w-5 h-5',
      sm: 'w-4 h-4',
      xl: 'w-8 h-8',
    },
  },
} as const;

const iconVariants = cva(iconStyles.base, {
  defaultVariants: iconStyles.default,
  variants: iconStyles.variants,
});

type IconVariants = VariantProps<typeof iconVariants>;

interface IconProps extends BaseComponentProps<HTMLAttributes<HTMLSpanElement>>, IconVariants {
  name: string;
}

const Icon = forwardRef<HTMLSpanElement, IconProps>(
  ({ className = '', name, props, size, useDefault = true }, ref) => {
    const finalClass = useDefault ? iconVariants({ className, size }) : className;

    return <span {...props} ref={ref} className={`${finalClass} ${name}`} />;
  },
);

Icon.displayName = 'Icon';

export type { IconProps, IconVariants };
export { Icon, iconStyles };
