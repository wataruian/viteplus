import type React from 'react';
import type { ElementType, ComponentProps as ReactComponentProps } from 'react';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
interface AsComponentProps<Component extends ElementType> {
  as?: Component;
}
type ComponentProps<
  Component extends ElementType = ElementType,
  Variant extends VariantType = string,
> = PolymorphicComponentProps<Component, ComponentVariantProps<Variant>>;
interface ComponentVariantProps<Variant extends VariantType = string> {
  className?: string;
  variants?: StyleConfig<Variant>[];
}
type OmitPolymorphicProps<
  Component extends ElementType,
  ComponentProps,
> = keyof (AsComponentProps<Component> & ComponentProps);
type PolymorphicComponentProps<
  Component extends ElementType,
  Props = Record<string, never>,
> = Omit<
  ReactComponentProps<Component>,
  OmitPolymorphicProps<Component, Props>
> &
  React.PropsWithChildren<AsComponentProps<Component> & Props>;
type PrefixedVariant<
  Variant extends string,
  Prefix extends string,
> = `${Prefix}-${Variant}`;
interface StyleConfig<Variant extends string> {
  base: string;
  variants: Record<Variant, string>;
}
type VariantType = string;

// ----------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------------

// Regex pattern for splitting whitespace-separated strings
const WHITESPACE_PATTERN = /\s+/;

/**
 * Generates a combined class string from base and selected variant classes
 * @param config
 * @param selectedVariants
 * @returns
 */
const getStyleClasses = <Variant extends string>(
  config: StyleConfig<Variant>,
  selectedVariants: Variant[] = []
): string => {
  const { base, variants } = config;
  const variantClasses = selectedVariants
    .map(variant => variants[variant])
    .filter(Boolean)
    .join(' ');
  return `${base} ${variantClasses}`.trim();
};

/**
 * Extracts unique CSS classes from a complex styles object
 * @param styles
 * @returns
 */
const getAllStyleClasses = (styles: Record<string, unknown>): string[] => {
  const extractClasses = (value: unknown): string[] => {
    if (typeof value === 'string') {
      return value.split(WHITESPACE_PATTERN).filter(Boolean);
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).flatMap(val => extractClasses(val));
    }
    return [];
  };

  const classes = Object.values(styles).flatMap(val => extractClasses(val));

  return [...new Set(classes)];
};

/**
 * Merges multiple style configurations into a single configuration
 * @param configs
 * @returns
 */
const mergeStyleConfigs = <Variant extends string>(
  ...configs: StyleConfig<Variant>[]
): StyleConfig<Variant> => {
  if (configs.length === 0) {
    throw new Error('At least one style configuration is required');
  }

  let mergedBase = '';
  let mergedVariants: Record<Variant, string> = {} as Record<Variant, string>;

  if (configs[0]) {
    mergedBase = configs[0].base;
    mergedVariants = { ...configs[0].variants };
  }

  for (const config of configs.slice(1)) {
    mergedBase += (mergedBase ? ' ' : '') + config.base;

    for (const [variant, variantClass] of Object.entries(config.variants)) {
      mergedVariants[variant as Variant] = variantClass as string;
    }
  }

  return {
    base: mergedBase.trim(),
    variants: mergedVariants,
  };
};

export type {
  AsComponentProps,
  ComponentProps,
  ComponentVariantProps,
  OmitPolymorphicProps,
  PolymorphicComponentProps,
  PrefixedVariant,
  StyleConfig,
  VariantType,
};

export { getAllStyleClasses, getStyleClasses, mergeStyleConfigs };
