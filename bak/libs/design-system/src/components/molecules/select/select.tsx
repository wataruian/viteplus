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
type SelectStyle = StyleConfig<SelectVariant>;
type SelectVariant = ColorCategory;

// ----------------------------------------------------------------------------
// STYLES
// ----------------------------------------------------------------------------
const SelectStyleClass: SelectStyle = {
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
const Select = forwardRef(
  <C extends ElementType = 'select'>(
    {
      as,
      children,
      className = '',
      variants = [] as StyleConfig<SelectVariant>[],
      ...props
    }: ComponentProps<C>,
    forwardedRef: ForwardedRef<HTMLSelectElement>
  ) => {
    const Component = (as || 'select') as ElementType;

    const finalVariants =
      variants.length > 0
        ? (Object.keys(variants.map(v => v.variants)) as SelectVariant[])
        : ['primary' as SelectVariant];

    const classes = [
      SelectStyleClass.base,
      getStyleClasses(SelectStyleClass, finalVariants),
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

Select.displayName = 'Select';

export type { SelectStyle, SelectVariant };
export { Select, SelectStyleClass };
