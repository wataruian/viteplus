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
type AlignType = 'around' | 'between' | 'center' | 'end' | 'start';
type DirectionType = 'column' | 'row';
type GapType =
  | 'gap-lg'
  | 'gap-md'
  | 'gap-none'
  | 'gap-sm'
  | 'gap-xl'
  | 'gap-xs';
type LayoutStyle = StyleConfig<LayoutVariant> & {
  base: string;
  variants: Record<LayoutVariant, string>;
};
type LayoutVariant =
  | 'card'
  | 'container'
  | 'fullscreen'
  | 'section'
  | GapType
  | PrefixedVariant<AlignType, 'align'>
  | PrefixedVariant<DirectionType, 'direction'>
  | PrefixedVariant<DirectionType, 'md-direction'>
  | WidthVariant;
type WidthVariant =
  | 'max-w-lg'
  | 'max-w-md'
  | 'max-w-sm'
  | 'max-w-xs'
  | 'w-full';

// ----------------------------------------------------------------------------
// STYLES
// ----------------------------------------------------------------------------
const LayoutStyleClass: LayoutStyle = {
  base: 'flex flex-col max-w-6xl mx-auto px-6 md:px-8', // Increased padding for larger screens
  variants: {
    'align-around': 'items-center justify-around',
    'align-between': 'items-center justify-between',
    'align-center': 'items-center justify-center',
    'align-end': 'items-end justify-end',
    // Alignment variants
    'align-start': 'items-start justify-start',
    card: 'rounded-lg shadow-md p-6 bg-white dark:bg-gray-800',
    // Layout variants
    container: 'max-w-6xl mx-auto px-6 md:px-8 w-full', // Updated padding in container variant
    // Direction variants
    'direction-column': 'flex-col',
    'direction-row': 'flex-row',
    fullscreen: 'w-full h-screen flex items-center justify-center',
    'gap-lg': 'gap-6',
    'gap-md': 'gap-4',
    // Gap variants
    'gap-none': 'gap-0',
    'gap-sm': 'gap-2',
    'gap-xl': 'gap-8',
    'gap-xs': 'gap-1',
    'max-w-lg': 'max-w-lg',
    'max-w-md': 'max-w-md',
    'max-w-sm': 'max-w-sm',
    'max-w-xs': 'max-w-xs',
    // Responsive direction variants
    'md-direction-column': 'md:flex-col',
    'md-direction-row': 'md:flex-row',
    section: 'w-full py-12 md:py-16', // Increased padding for larger screens
    // Width variants
    'w-full': 'w-full',
  },
};

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------
const Layout = forwardRef(
  <C extends ElementType = 'div'>(
    {
      as,
      children,
      className = '',
      variants = [] as StyleConfig<LayoutVariant>[],
      ...props
    }: ComponentProps<C>,
    forwardedRef: ForwardedRef<HTMLDivElement>
  ) => {
    const Component = (as || 'div') as ElementType;

    const finalVariants =
      variants.length > 0
        ? (Object.keys(variants.map(v => v.variants)) as LayoutVariant[])
        : ['container' as LayoutVariant];

    const classes = [
      LayoutStyleClass.base,
      getStyleClasses(LayoutStyleClass, finalVariants),
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

Layout.displayName = 'Layout';

export type {
  AlignType,
  DirectionType,
  GapType,
  LayoutStyle,
  LayoutVariant,
  WidthVariant,
};

export { Layout, LayoutStyleClass };
