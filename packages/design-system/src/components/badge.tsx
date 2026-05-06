import { type HTMLAttributes, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { baseStyles, intentSoft } from '../tokens/base';
import type { BaseComponentProps } from '../types/component';

const badgeStyles = {
  base: 'inline-flex items-center justify-center font-black uppercase tracking-widest transition-all duration-300 shadow-sm backdrop-blur-sm',
  default: {
    intent: 'primary' as const,
    size: 'md' as const,
  },
  variants: {
    intent: {
      accent: intentSoft('accent'),
      danger: intentSoft('danger'),
      glass: `${baseStyles.colors.bg.adaptiveSurface}/15 ${baseStyles.colors.text.inverseSurface} ring-1 ${baseStyles.colors.ring.adaptiveSurface}/10`,
      info: intentSoft('info'),
      outline: `${baseStyles.colors.bg.transparent} ${baseStyles.colors.text.inverseSurface} ring-1 ${baseStyles.colors.ring.inverseSurface}/10`,
      primary: intentSoft('primary'),
      success: intentSoft('success'),
      warning: intentSoft('warning'),
    },
    size: {
      lg: 'px-4 py-1.5 text-sm rounded-full',
      md: 'px-3 py-1 text-xs rounded-full',
      sm: 'px-2.5 py-0.5 text-[10px] rounded-full',
    },
  },
} as const;

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
export { Badge, badgeStyles };
