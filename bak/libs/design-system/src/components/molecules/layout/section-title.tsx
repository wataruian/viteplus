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
type SectionTitleAlignment = 'center' | 'justify' | 'left' | 'right';
type SectionTitleSpacing = PrefixedVariant<
  'lg' | 'md' | 'sm' | 'xl' | 'xs',
  'mb'
>;
type SectionTitleStyle = StyleConfig<SectionTitleVariant>;
type SectionTitleVariant =
  | 'body'
  | 'caption'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'small'
  | 'span'
  | PrefixedVariant<SectionTitleAlignment, 'align'>
  | SectionTitleSpacing;

// ----------------------------------------------------------------------------
// STYLES
// ----------------------------------------------------------------------------
const SectionTitleStyleClass: SectionTitleStyle = {
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
const SectionTitle = forwardRef(
  <C extends ElementType = 'h2' | 'span'>(
    {
      as,
      children,
      className = '',
      heading = true,
      variants = [] as StyleConfig<SectionTitleVariant>[],
      ...props
    }: ComponentProps<C>,
    forwardedRef: ForwardedRef<HTMLSpanElement>
  ) => {
    const elementType = heading ? 'h2' : 'span';
    const Component = (as || elementType) as ElementType;

    const finalVariants =
      variants.length > 0
        ? (Object.keys(variants.map(v => v.variants)) as SectionTitleVariant[])
        : ['primary' as SectionTitleVariant];

    const classes = [
      SectionTitleStyleClass.base,
      getStyleClasses(SectionTitleStyleClass, finalVariants),
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

SectionTitle.displayName = 'SectionTitle';

export type { SectionTitleStyle, SectionTitleVariant };
export { SectionTitle, SectionTitleStyleClass };
