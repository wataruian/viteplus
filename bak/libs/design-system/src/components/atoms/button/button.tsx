import { type ElementType, type ForwardedRef, forwardRef } from 'react';

import type { ColorCategory } from '../../../core/color';

import {
  type ComponentProps,
  getStyleClasses,
  type StyleConfig,
} from '../../../utils/extractor';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
type ButtonSize = 'full-width' | 'lg' | 'md' | 'sm';
type ButtonStyle = StyleConfig<ButtonVariant>;
type ButtonVariant = ButtonSize | ColorCategory;

// ----------------------------------------------------------------------------
// STYLES
// ----------------------------------------------------------------------------
const ButtonStyleClass: ButtonStyle = {
  base: 'py-3 px-6 rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
  variants: {
    accent:
      'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 focus:ring-accent-500',
    error:
      'bg-error-500 text-white hover:bg-error-600 active:bg-error-700 focus:ring-error-500',
    'full-width': 'w-full',
    info: 'bg-info-500 text-white hover:bg-info-600 active:bg-info-700 focus:ring-info-500',
    lg: 'text-lg py-4 px-8',
    md: 'text-base py-3 px-6',
    neutral:
      'bg-neutral-500 text-white hover:bg-neutral-600 active:bg-neutral-700 focus:ring-neutral-500',
    primary:
      'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 focus:ring-primary-500',
    secondary:
      'bg-secondary-500 text-white hover:bg-secondary-600 active:bg-secondary-700 focus:ring-secondary-500',
    // Size variants
    sm: 'text-sm py-2 px-4',
    success:
      'bg-success-500 text-white hover:bg-success-600 active:bg-success-700 focus:ring-success-500',
    warning:
      'bg-warning-500 text-white hover:bg-warning-600 active:bg-warning-700 focus:ring-warning-500',
  },
};

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------
const Button = forwardRef(
  <C extends ElementType = 'button'>(
    {
      as,
      children,
      className = '',
      variants = [] as StyleConfig<ButtonVariant>[],
      ...props
    }: ComponentProps<C>,
    forwardedRef: ForwardedRef<HTMLButtonElement>
  ) => {
    const Component = (as || 'button') as ElementType;

    const finalVariants =
      variants.length > 0
        ? (Object.keys(variants.map(v => v.variants)) as ButtonVariant[])
        : ['primary' as ButtonVariant];

    const classes = [
      ButtonStyleClass.base,
      getStyleClasses(ButtonStyleClass, finalVariants),
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <Component className={classes} ref={forwardedRef} {...props}>
        {children}
      </Component>
    );
  }
);

Button.displayName = 'Button';

export type { ButtonSize, ButtonStyle, ButtonVariant };
export { Button, ButtonStyleClass };
