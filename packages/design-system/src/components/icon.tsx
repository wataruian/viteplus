import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { iconStyles } from '../tokens/styles';

const iconVariants = cva(iconStyles.base, {
  defaultVariants: iconStyles.default,
  variants: iconStyles.variants,
});

type IconVariants = VariantProps<typeof iconVariants>;

interface IconProps extends BaseComponentProps<HTMLAttributes<HTMLSpanElement>>, IconVariants {
  name: string;
}

const Icon = forwardRef<HTMLSpanElement, IconProps>(
  ({ className = '', name, props, size, useDefault = false }, ref) => {
    const finalClass = useDefault ? iconVariants({ className, size }) : className;

    return <span {...props} ref={ref} className={`${finalClass} ${name}`} />;
  },
);

Icon.displayName = 'Icon';

export type { IconProps, IconVariants };
export { Icon, iconVariants };
