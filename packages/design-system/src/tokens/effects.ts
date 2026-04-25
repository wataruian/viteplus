const blurs = {
  '2xl': '40px',
  '3xl': '64px',
  default: '8px',
  lg: '16px',
  md: '12px',
  sm: '4px',
  xl: '24px',
} as const;

const glassmorphism = {
  accent: {
    bg: 'rgba(var(--accent-base), 0.1)',
    blur: '16px',
    border: '1px solid rgba(var(--accent-base), 0.2)',
  },
  dark: {
    bg: 'rgba(0, 0, 0, 0.4)',
    blur: '24px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  light: {
    bg: 'rgba(255, 255, 255, 0.4)',
    blur: '24px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  },
  premium: {
    bg: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
    blur: '32px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
} as const;

const glows = {
  accent: 'shadow-[0_0_20px_rgba(var(--accent-base),0.4)]',
  danger: 'shadow-[0_0_20px_rgba(var(--danger-base),0.4)]',
  primary: 'shadow-[0_0_20px_rgba(var(--primary-base),0.4)]',
} as const;

const motion = {
  animations: {
    marquee: 'from{transform:translateX(0);}to{transform:translateX(calc(-100% - 1rem));}',
    marqueeReverse: 'from{transform:translateX(calc(-100% - 1rem));}to{transform:translateX(0);}',
  },
  durations: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  easings: {
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    premium: 'cubic-bezier(0.23, 1, 0.32, 1)',
  },
} as const;

const shadows = {
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  premium: '0 0 50px rgba(0,0,0,0.5)',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
} as const;

export { blurs, glassmorphism, glows, motion, shadows };
