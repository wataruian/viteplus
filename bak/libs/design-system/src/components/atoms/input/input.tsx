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
type InputStyle = StyleConfig<InputVariant>;
type InputVariant = ColorCategory;

// ----------------------------------------------------------------------------
// STYLES
// ----------------------------------------------------------------------------
const InputStyleClass: InputStyle = {
  base: 'py-2 px-4 rounded',
  variants: {
    accent: 'bg-accent-500 text-white py-2 px-4 rounded',
    error: 'bg-error-500 text-white py-2 px-4 rounded',
    info: 'bg-info-500 text-white py-2 px-4 rounded',
    neutral: 'bg-neutral-500 text-white py-2 px-4 rounded',
    primary: 'bg-primary-500 text-white py-2 px-4 rounded',
    secondary: 'bg-secondary-500 text-white py-2 px-4 rounded',
    success: 'bg-success-500 text-white py-2 px-4 rounded',
    warning: 'bg-warning-500 text-white py-2 px-4 rounded',
  },
};

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------
const Input = forwardRef(
  <C extends ElementType = 'input'>(
    {
      as,
      children,
      className = '',
      variants = [] as StyleConfig<InputVariant>[],
      ...props
    }: ComponentProps<C>,
    forwardedRef: ForwardedRef<HTMLInputElement>
  ) => {
    const Component = (as || 'input') as ElementType;

    const finalVariants =
      variants.length > 0
        ? (Object.keys(variants.map(v => v.variants)) as InputVariant[])
        : ['primary' as InputVariant];

    const classes = [
      InputStyleClass.base,
      getStyleClasses(InputStyleClass, finalVariants),
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

Input.displayName = 'Input';

export type { InputStyle, InputVariant };
export { Input, InputStyleClass };
