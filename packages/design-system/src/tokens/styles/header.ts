const headerStyles = {
  base: 'fixed top-0 left-0 right-0 z-50 h-20 bg-black/40 backdrop-blur-xl border-b border-white/5',
  default: {
    look: 'default' as const,
  },
  variants: {
    look: {
      default: {
        inner: 'h-full flex items-center justify-between',
      },
    },
  },
} as const;

export { headerStyles };
