import { type HTMLAttributes, createElement, forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import type { BaseComponentProps } from './base';
import { baseStyles } from '../tokens/base';

const typographyStyles = {
  base: '',
  default: {
    type: 'body' as const,
  },
  variants: {
    type: {
      body: `text-lg ${baseStyles.colors.text.inverseSurface}/60 leading-relaxed font-medium`,
      caption: `text-sm ${baseStyles.colors.text.inversePrimary}/60 font-mono uppercase tracking-widest`,
      display: `text-liquid-display font-black leading-compressed tracking-tighter ${baseStyles.colors.text.inverseSurface} font-header`,
      headline: `text-4xl md:text-5xl font-black ${baseStyles.colors.text.inverseSurface} font-header tracking-tight`,
      subHeadline: `text-2xl font-bold ${baseStyles.colors.text.inverseSurface}`,
    },
  },
} as const;

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
export { Typography, typographyStyles };
