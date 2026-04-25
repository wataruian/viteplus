const badgeStyles = {
  base: 'inline-flex items-center justify-center font-black uppercase tracking-widest border transition-all duration-300 shadow-sm backdrop-blur-sm',
  default: {
    intent: 'primary' as const,
    size: 'md' as const,
  },
  variants: {
    intent: {
      accent: 'bg-accent/15 text-accent border-accent/25',
      danger: 'bg-danger/15 text-danger border-danger/25',
      glass: 'bg-white/10 text-white border border-white/20',
      info: 'bg-info/15 text-info border-info/25',
      outline: 'bg-transparent text-adaptive-text-muted border-adaptive-border',
      primary: 'bg-primary/15 text-primary border-primary/25',
      success: 'bg-success/15 text-success border-success/25',
      warning: 'bg-warning/15 text-warning border-warning/25',
    },
    size: {
      lg: 'px-4 py-1.5 text-sm rounded-full',
      md: 'px-3 py-1 text-xs rounded-full',
      sm: 'px-2.5 py-0.5 text-[10px] rounded-full',
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
      accent: 'bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent/90',
      danger: 'bg-danger text-white shadow-lg shadow-danger/20 hover:bg-danger/90',
      ghost:
        'bg-transparent text-adaptive-text-muted hover:bg-adaptive-bg-alt hover:text-adaptive-text',
      glass: 'bg-white/5 text-white border border-white/10 backdrop-blur-md hover:bg-white/10',
      inverse: `bg-adaptive-inverse !text-adaptive-inverse-text hover:opacity-90`,
      outline:
        'bg-transparent text-adaptive-text border border-adaptive-border hover:bg-adaptive-bg-alt shadow-sm',
      premium:
        'bg-gradient-to-br from-primary via-accent to-primary bg-[length:200%_200%] animate-gradient text-white shadow-xl shadow-primary/30 hover:scale-[1.02]',
      primary: 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90',
      secondary:
        'bg-adaptive-bg-alt text-adaptive-text border border-adaptive-border hover:bg-adaptive-bg shadow-md',
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
      glass: 'bg-adaptive-bg/40 border border-adaptive-border/50 backdrop-blur-xl shadow-2xl',
      outline: 'bg-transparent border-2 border-adaptive-border shadow-sm hover:border-primary/30',
      premium:
        'bg-adaptive-bg-alt border border-primary/20 shadow-xl shadow-primary/5 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/5 before:to-transparent',
      primary: 'bg-adaptive-bg border border-adaptive-border shadow-xl',
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
  base: 'w-full bg-adaptive-bg border border-adaptive-border rounded-xl px-4 py-3 text-adaptive-text placeholder:text-adaptive-text-muted transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-sm',
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
    componentCard: 'flex flex-col items-center justify-center gap-6 p-8',
    componentsGrid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
    content: 'flex flex-col gap-12 md:gap-16',
    controls:
      'flex flex-wrap items-center gap-2 bg-adaptive-bg-alt p-1.5 rounded-xl border border-adaptive-border shadow-sm w-fit',
    description: 'max-w-2xl opacity-90',
    divider: 'w-[1px] h-11 bg-adaptive-inverse mx-1 hidden sm:block',
    header: 'flex flex-col md:flex-row md:items-start justify-between gap-8',
    headerInfo: 'flex-1 space-y-6 md:space-y-8 pt-12 md:pt-24',
    section: 'space-y-6',
    sectionHeader: 'flex items-center gap-3',
    swatchColor:
      'w-12 h-12 md:w-16 md:h-16 rounded-xl border border-adaptive-inverse shadow-sm ring-2 ring-adaptive-inverse/20 hover:scale-110 hover:shadow-lg transition-transform duration-300 cursor-pointer',
    swatchDivider: 'w-[1px] h-12 md:h-16 bg-adaptive-inverse mx-1 self-start',
    swatchItem: 'flex flex-col gap-2',
    swatchLabel: 'text-[10px] md:text-xs font-mono text-adaptive-text-muted text-center',
    swatchesContainer: 'flex flex-wrap gap-3 items-start',
    themesContainer: 'space-y-12 md:space-y-20',
    themesGrid: 'grid gap-12',
    themesSection: 'space-y-8',
    themesTitle: 'uppercase tracking-widest opacity-70',
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
