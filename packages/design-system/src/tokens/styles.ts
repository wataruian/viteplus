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
      ghost: 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-white',
      glass: 'bg-white/5 text-white border border-white/10 backdrop-blur-md hover:bg-white/10',
      outline:
        'bg-transparent text-white border border-white/10 hover:border-primary/50 hover:bg-primary/5',
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
      section: 'py-24 md:py-40 relative overflow-hidden',
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

const themeSwitcherStyles = {
  base: '',
  default: {
    intent: 'secondary' as const,
    size: 'sm' as const,
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

const typographyStyles = {
  base: '',
  default: {
    type: 'body' as const,
  },
  variants: {
    type: {
      body: 'text-lg text-slate-400 leading-relaxed font-medium',
      caption: 'text-sm text-slate-500 font-mono uppercase tracking-widest',
      display:
        'text-liquid-display font-black leading-compressed tracking-tighter text-white font-header',
      headline: 'text-4xl md:text-5xl font-black text-white font-header tracking-tight',
      subheadline: 'text-2xl font-bold text-white',
    },
  },
} as const;

const previewStyles = {
  base: 'flex flex-col gap-8 p-8 lg:p-16 max-w-7xl mx-auto font-sans selection:bg-primary/30',
  default: {},
  slots: {
    adaptiveDemo: 'p-4 rounded-xl bg-inverse text-adaptive font-medium shadow-inner',
    adaptiveDemoStack: 'flex flex-col gap-2',
    buttonRow: 'flex gap-2',
    colorSwatch: 'flex flex-col gap-1 items-center min-w-12 group',
    colorSwatchChip:
      'w-full h-12 rounded-lg border border-adaptive shadow-sm transition-transform group-hover:scale-105',
    colorSwatchLabel: 'text-[10px] opacity-60',
    controlBar:
      'flex flex-wrap gap-4 p-2 bg-adaptive-alt rounded-2xl border border-adaptive shadow-lg backdrop-blur-md',
    controlGroup: 'flex gap-1 bg-adaptive p-1 rounded-xl border border-adaptive',
    footer:
      'mt-16 pt-8 border-t border-adaptive flex justify-between items-center opacity-30 text-[10px] font-mono uppercase tracking-[0.2em] font-bold',
    header: 'flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8',
    headerTitleGroup: 'flex flex-col gap-2',
    iconMoon: 'i-ph-moon-bold',
    iconSun: 'i-ph-sun-bold',
    main: 'transition-all duration-300 transform-gpu',
    modeButton: 'capitalize flex items-center gap-2',
    primaryDemo: 'p-4 rounded-xl border-2 border-primary text-primary font-bold',
    scaleDivider: 'w-px h-12 bg-adaptive mx-2 opacity-20',
    scaleRow: 'flex flex-col gap-3',
    scaleRowGrid: 'flex flex-wrap gap-2',
    scaleRowLabel: 'tracking-widest opacity-40 ml-1',
    semanticGrid: 'grid grid-cols-1 md:grid-cols-2 gap-4 mt-8',
    showcaseCard: 'p-6 flex flex-col gap-4',
    showcaseCardTitle: 'opacity-50',
    subtitle: 'text-lg text-adaptive opacity-60 font-medium',
    surfaceGrid: 'grid grid-cols-2 gap-3',
    surfaceItem:
      'h-16 rounded-xl border border-adaptive flex items-end p-2 text-[10px] font-mono opacity-50',
    themeCard:
      'p-8 rounded-[2rem] bg-adaptive text-adaptive border border-adaptive shadow-2xl flex flex-col gap-8 transition-all duration-500 overflow-hidden relative min-h-[600px]',
    themeGlowBottom:
      'absolute bottom-0 left-0 w-96 h-96 bg-accent/10 blur-[120px] pointer-events-none animate-pulse',
    themeGlowTop:
      'absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[120px] pointer-events-none animate-pulse',
    themeHeader: 'flex justify-between items-end border-b border-adaptive pb-6',
    themeMain: 'space-y-10',
    themeModeAccent: 'uppercase text-primary font-bold',
    themeModeText: 'text-sm mt-2 font-medium',
    themeSelectorButton: 'capitalize',
    themeTitle: 'capitalize leading-none',
    themeWrapper: 'contents',
    title: 'text-6xl font-black tracking-tighter text-adaptive',
  },
  variants: {},
} as const;

export {
  badgeStyles,
  buttonStyles,
  cardStyles,
  iconStyles,
  inputStyles,
  layoutStyles,
  logoStyles,
  marqueeStyles,
  themeSwitcherStyles,
  typographyStyles,
  previewStyles,
};
