import { type HTMLAttributes, createElement, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from '../types/component';
import { typographyStyles } from '../tokens/styles';

const typographyVariants = cva(typographyStyles.base, {
  defaultVariants: typographyStyles.default,
  variants: typographyStyles.variants,
});

type TypographyVariants = VariantProps<typeof typographyVariants>;

interface TypographyProps
  extends BaseComponentProps<HTMLAttributes<HTMLElement>>, TypographyVariants {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'label' | 'div';
}

const Typography = forwardRef<HTMLElement, TypographyProps>(
  ({ as: Component = 'p', children, className = '', props, type, useDefault = true }, ref) => {
    const finalClass = useDefault ? typographyVariants({ className, type }) : className;

    return createElement(
      Component,
      {
        ...props,
        className: finalClass,
        ref,
      },
      children,
    );
  },
);

Typography.displayName = 'Typography';

export type { TypographyProps, TypographyVariants };
export { Typography, typographyVariants };
