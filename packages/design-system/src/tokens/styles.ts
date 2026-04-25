const badgeStyles = {
  base: 'inline-flex items-center justify-center font-black uppercase tracking-widest border transition-all duration-300',
  default: {
    intent: 'primary' as const,
    size: 'md' as const,
  },
  variants: {
    intent: {
      accent: 'bg-accent/10 text-accent border-accent/20',
      danger: 'bg-danger/10 text-danger border-danger/20',
      glass: 'bg-white/5 text-white border border-white/10 backdrop-blur-sm',
      info: 'bg-info/10 text-info border-info/20',
      outline: 'bg-transparent text-slate-400 border-white/10',
      primary: 'bg-primary/10 text-primary border-primary/20',
      success: 'bg-success/10 text-success border-success/20',
      warning: 'bg-warning/10 text-warning border-warning/20',
    },
    size: {
      lg: 'px-4 py-1.5 text-sm rounded-lg',
      md: 'px-3 py-1 text-xs rounded-md',
      sm: 'px-2.5 py-0.5 text-[10px] rounded',
    },
  },
} as const;

const buttonStyles = {
  base: 'inline-flex items-center justify-center font-bold tracking-tight transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
  default: {
    intent: 'primary' as const,
    size: 'md' as const,
  },
  variants: {
    intent: {
      accent: 'bg-accent text-black hover:bg-accent/90',
      danger: 'bg-danger text-white hover:bg-danger/90',
      ghost:
        'bg-transparent text-adaptive-text-muted hover:bg-adaptive-border hover:text-adaptive-text',
      glass: 'bg-white/5 text-white border border-white/10 backdrop-blur-md hover:bg-white/10',
      inverse: `bg-adaptive-inverse !text-adaptive-inverse-text hover:opacity-90`,
      outline:
        'bg-transparent text-adaptive-text border border-adaptive-border hover:bg-adaptive-border',
      premium: 'bg-primary text-black hover:bg-primary/90',
      primary: 'bg-white text-black hover:bg-white/90',
      secondary: 'bg-slate-800 text-white hover:bg-slate-700',
    },
    size: {
      lg: 'h-14 px-8 text-lg rounded-xl',
      md: 'h-11 px-6 text-base rounded-lg',
      sm: 'h-9 px-4 text-sm rounded-md',
      xl: 'h-16 px-10 text-xl rounded-2xl',
    },
  },
} as const;

const cardStyles = {
  base: 'rounded-2xl overflow-hidden transition-all duration-300',
  default: {
    intent: 'primary' as const,
  },
  variants: {
    intent: {
      glass: 'bg-white/5 border border-white/10 backdrop-blur-sm',
      outline: 'bg-transparent border border-white/10',
      premium: 'bg-slate-900 border border-primary/20',
      primary: 'bg-slate-900 border border-white/5',
    },
  },
} as const;

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

const inputStyles = {
  base: 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
  default: {
    state: 'default' as const,
  },
  variants: {
    state: {
      default: '',
      error: 'border-danger/50 focus:ring-danger/20 focus:border-danger/50',
      success: 'border-success/50 focus:ring-success/20 focus:border-success/50',
    },
  },
} as const;

const logoStyles = {
  base: 'flex items-center gap-2 font-black',
  default: {},
  slots: {
    bottom: 'text-2xl tracking-tighter text-white',
    inner: 'flex flex-col items-start leading-compressed',
    top: 'text-primary',
  },
  variants: {},
} as const;

const layoutStyles = {
  base: '',
  default: {
    type: 'container' as const,
  },
  variants: {
    type: {
      appRoot: 'min-h-screen font-sans',
      container: 'max-w-layout mx-auto px-6 md:px-10',
      header:
        'fixed top-0 left-0 right-0 z-50 h-20 bg-black/40 backdrop-blur-xl border-b border-white/5',
      headerInner: 'h-full flex items-center justify-between',
      section: 'py-12 md:py-20 relative overflow-hidden',
    },
  },
} as const;

const marqueeStyles = {
  base: 'flex select-none overflow-hidden gap-4',
  default: {
    direction: 'left' as const,
    pauseOnHover: true,
    speed: 'medium' as const,
  },
  slots: {
    track: 'flex shrink-0 items-center justify-around gap-4 min-w-full',
  },
  variants: {
    direction: {
      left: 'animate-marquee',
      right: 'animate-marquee-reverse',
    },
    pauseOnHover: {
      false: '',
      true: 'hover:[animation-play-state:paused]',
    },
    speed: {
      fast: '20',
      medium: '40',
      slow: '60',
    },
  },
} as const;

const modeSwitcherStyles = {
  base: 'aspect-square flex items-center justify-center !p-0',
  default: {
    intent: 'ghost' as const,
    size: 'md' as const,
  },
  slots: {
    moonIcon: 'i-ph-moon-bold',
    sunIcon: 'i-ph-sun-bold',
  },
  variants: {
    intent: buttonStyles.variants.intent,
    size: buttonStyles.variants.size,
  },
} as const;

const themeSwitcherStyles = {
  base: 'flex flex-wrap gap-1 bg-adaptive-bg p-1 rounded-xl border border-adaptive-border-alt shadow-sm w-fit',
  default: {
    plain: false,
    size: 'sm' as const,
  },
  slots: {
    activeIntent: 'inverse',
    button: 'capitalize font-medium shadow-none transition-colors',
    inactiveIntent: 'ghost',
  },
  variants: {
    plain: {
      false: '',
      true: '!bg-transparent !border-none !shadow-none !p-0',
    },
    size: {
      lg: 'gap-2 p-2',
      md: 'gap-1.5 p-1.5',
      sm: 'gap-1 p-1',
    },
  },
} as const;

const typographyStyles = {
  base: '',
  default: {
    type: 'body' as const,
  },
  variants: {
    type: {
      body: 'text-lg text-adaptive-text-muted leading-relaxed font-medium',
      caption: 'text-sm text-adaptive-text-muted-alt font-mono uppercase tracking-widest',
      display:
        'text-liquid-display font-black leading-compressed tracking-tighter text-adaptive-text font-header',
      headline: 'text-4xl md:text-5xl font-black text-adaptive-text font-header tracking-tight',
      subHeadline: 'text-2xl font-bold text-adaptive-text',
    },
  },
} as const;

const previewStyles = {
  base: 'pt-6 md:pt-10',
  default: {},
  slots: {
    actions: 'flex shrink-0 items-center gap-4 self-start',
    content: 'flex flex-col gap-12 md:gap-16',
    controls:
      'flex flex-wrap items-center gap-2 bg-adaptive-bg-alt p-1.5 rounded-xl border border-adaptive-border shadow-sm w-fit',
    description: 'max-w-2xl opacity-90',
    divider: 'w-[1px] h-11 bg-adaptive-inverse opacity-15 mx-1 hidden sm:block',
    header: 'flex flex-col md:flex-row md:items-start justify-between gap-8',
    headerInfo: 'flex-1 space-y-6 md:space-y-8 pt-12 md:pt-24',
    section: 'space-y-6',
    sectionDivider: 'w-8 h-[2px] bg-primary/40',
    sectionHeader: 'flex items-center gap-3',
  },
  variants: {},
} as const;

const errorBoundaryStyles = {
  base: 'p-12 border border-danger/20 bg-danger/5 rounded-3xl flex flex-col items-center text-center backdrop-blur-sm',
  default: {},
  slots: {
    container: 'flex flex-col items-center gap-6',
    content: 'space-y-2',
    description: 'text-adaptive-text-muted text-lg leading-relaxed max-w-lg',
    icon: 'i-ph-warning-octagon-duotone text-6xl text-danger/80',
    title: 'text-danger font-black text-3xl tracking-tight',
  },
  variants: {},
} as const;

export {
  badgeStyles,
  buttonStyles,
  cardStyles,
  errorBoundaryStyles,
  iconStyles,
  inputStyles,
  layoutStyles,
  logoStyles,
  marqueeStyles,
  modeSwitcherStyles,
  themeSwitcherStyles,
  typographyStyles,
  previewStyles,
};
