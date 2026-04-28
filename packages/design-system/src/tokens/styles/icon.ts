const iconStyles = {
  base: 'inline-block shrink-0',
  default: {
    size: 'md' as const,
  },
  variants: {
    size: {
      lg: 'w-6 h-6',
      md: 'w-5 h-5',
      sm: 'w-4 h-4',
      xl: 'w-8 h-8',
    },
  },
} as const;

export { iconStyles };
