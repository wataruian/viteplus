import { type ElementType, type ForwardedRef, forwardRef } from 'react';

import {
  type ComponentProps,
  getStyleClasses,
  type PrefixedVariant,
  type StyleConfig,
} from '../../../utils/extractor';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
type TextAlignment = 'center' | 'justify' | 'left' | 'right';
type TextSpacing = PrefixedVariant<'lg' | 'md' | 'sm' | 'xl' | 'xs', 'mb'>;
type TextStyle = StyleConfig<TextVariant>;
type TextVariant =
  | 'body'
  | 'caption'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'small'
  | 'span'
  | PrefixedVariant<TextAlignment, 'align'>
  | TextSpacing;

// ----------------------------------------------------------------------------
// STYLES
// ----------------------------------------------------------------------------
const TextStyleClass: TextStyle = {
  base: 'text-gray-900 dark:text-gray-100',
  variants: {
    'align-center': 'text-center',
    'align-justify': 'text-justify',
    // Alignment variants
    'align-left': 'text-left',
    'align-right': 'text-right',
    body: 'text-base md:text-lg',
    caption: 'text-xs md:text-sm',
    // Typography variants
    h1: 'text-4xl md:text-5xl font-bold',
    h2: 'text-2xl md:text-3xl font-semibold',
    h3: 'text-xl md:text-2xl font-medium',
    h4: 'text-lg md:text-xl font-medium',
    'mb-lg': 'mb-6',
    'mb-md': 'mb-4',
    'mb-sm': 'mb-2',
    'mb-xl': 'mb-8',
    // Margin bottom (spacing) variants
    'mb-xs': 'mb-1',
    small: 'text-sm md:text-base',
    span: '',
  },
};

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------
const Text = forwardRef(
  <C extends ElementType = 'span'>(
    {
      as,
      children,
      className = '',
      variants = [] as StyleConfig<TextVariant>[],
      ...props
    }: ComponentProps<C>,
    forwardedRef: ForwardedRef<HTMLSpanElement>
  ) => {
    const Component = (as || 'span') as ElementType;

    const finalVariants =
      variants.length > 0
        ? (Object.keys(variants.map(v => v.variants)) as TextVariant[])
        : ['primary' as TextVariant];

    const classes = [
      TextStyleClass.base,
      getStyleClasses(TextStyleClass, finalVariants),
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

Text.displayName = 'Text';

export type { TextStyle, TextVariant };
export { Text, TextStyleClass };
