const layoutStyles = {
  base: '',
  default: {
    type: 'container' as const,
  },
  variants: {
    type: {
      appRoot: 'min-h-screen font-sans',
      container: 'max-w-layout mx-auto px-6 md:px-10',
      section: 'py-4 md:py-8 relative overflow-hidden',
    },
  },
} as const;

export { layoutStyles };
