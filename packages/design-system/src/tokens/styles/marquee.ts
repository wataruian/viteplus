const marqueeStyles = {
  base: 'flex w-full select-none overflow-hidden',
  default: {
    direction: 'left' as const,
    look: 'default' as const,
    pauseOnHover: true,
    speed: 'medium' as const,
  },
  variants: {
    direction: {
      left: '[&>.track]:animate-marquee',
      right: '[&>.track]:animate-marquee-reverse',
    },
    look: {
      default: {
        track: 'flex shrink-0 items-center justify-around gap-4 min-w-full',
      },
    },
    pauseOnHover: {
      false: '',
      true: 'hover:[&>.track]:[animation-play-state:paused]',
    },
    speed: {
      fast: '20',
      medium: '40',
      slow: '60',
    },
  },
} as const;

export { marqueeStyles };
