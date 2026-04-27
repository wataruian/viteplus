const badgeStyles = {
  base: 'inline-flex items-center justify-center font-black uppercase tracking-widest transition-all duration-300 shadow-sm backdrop-blur-sm',
  default: {
    intent: 'primary' as const,
    size: 'md' as const,
  },
  variants: {
    intent: {
      accent: 'bg-accent/15 text-accent',
      danger: 'bg-danger/15 text-danger',
      glass: 'bg-adaptive-surface/15 text-inverse-surface ring-1 ring-inverse-surface/10',
      info: 'bg-info/15 text-info',
      outline: 'bg-transparent text-inverse-surface ring-1 ring-inverse-surface/10',
      primary: 'bg-primary/15 text-primary',
      success: 'bg-success/15 text-success',
      warning: 'bg-warning/15 text-warning',
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
        'bg-transparent text-inverse-surface hover:bg-adaptive-surface hover:text-inverse-surface',
      info: 'bg-info text-white shadow-lg shadow-info/20 hover:bg-info/90',
      inverse: 'bg-inverse-primary text-adaptive-primary hover:opacity-90',
      premium:
        'bg-gradient-to-br from-primary via-accent to-primary bg-[length:200%_200%] animate-gradient text-white shadow-xl shadow-primary/30 hover:scale-[1.02]',
      primary: 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90',
      secondary:
        'bg-adaptive-surface text-inverse-surface shadow-lg shadow-adaptive-surface/20 hover:bg-inverse-surface hover:text-adaptive-surface',
      success: 'bg-success text-white shadow-lg shadow-success/20 hover:bg-success/90',

      warning: 'bg-warning text-white shadow-lg shadow-warning/20 hover:bg-warning/90',
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
  base: 'rounded-2xl overflow-hidden transition-all duration-300 p-6',
  default: {
    intent: 'primary' as const,
  },
  variants: {
    intent: {
      glass: 'bg-adaptive-surface/40 backdrop-blur-xl shadow-2xl',
      outline: 'bg-transparent shadow-sm ring-1 ring-inverse-surface/10',
      premium:
        'bg-adaptive-surface shadow-2xl shadow-primary/10 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/10 before:via-transparent before:to-accent/5 hover:scale-[1.01] ring-1 ring-primary/30',
      primary: 'bg-adaptive-primary shadow-lg shadow-adaptive-primary/20',
    },
  },
} as const;

const errorBoundaryStyles = {
  base: 'p-12 rounded-3xl flex flex-col items-center text-center backdrop-blur-sm',
  default: {
    intent: 'danger' as const,
  },
  variants: {
    intent: {
      danger: {
        base: 'bg-danger/10',
        container: 'flex flex-col items-center gap-6',
        content: 'space-y-2',
        description: 'text-inverse-surface/60 text-lg leading-relaxed max-w-lg',
        icon: 'i-ph-warning-octagon-duotone text-6xl text-danger/80',
        title: 'text-danger font-black text-3xl tracking-tight',
      },
      warning: {
        base: 'bg-warning/10',
        container: 'flex flex-col items-center gap-6',
        content: 'space-y-2',
        description: 'text-inverse-surface/60 text-lg leading-relaxed max-w-lg',
        icon: 'i-ph-warning-duotone text-6xl text-warning/80',
        title: 'text-warning font-black text-3xl tracking-tight',
      },
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
  base: 'w-full max-w-full box-border min-w-0 bg-adaptive-surface/50 rounded-xl px-4 py-3 text-inverse-surface placeholder:text-inverse-surface/40 transition-all focus:outline-none focus:ring-2 shadow-sm',
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

const logoStyles = {
  base: 'flex items-center gap-2 font-black',
  default: {
    look: 'default' as const,
  },
  variants: {
    look: {
      default: {
        bottom: 'text-2xl tracking-tighter text-white',
        inner: 'flex flex-col items-start leading-compressed',
        top: 'text-primary',
      },
    },
  },
} as const;

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

const modeSwitcherStyles = {
  base: 'aspect-square flex items-center justify-center !p-0',
  default: {
    intent: 'ghost' as const,
    look: 'default' as const,
    size: 'md' as const,
  },
  variants: {
    intent: buttonStyles.variants.intent,
    look: {
      default: {
        moonIcon: 'i-ph-moon-bold',
        sunIcon: 'i-ph-sun-bold',
      },
    },
    size: buttonStyles.variants.size,
  },
} as const;

const themeSwitcherStyles = {
  base: 'flex flex-wrap gap-1 bg-adaptive-surface p-1 rounded-xl border border-inverse-surface/10 shadow-sm w-fit',
  default: {
    look: 'default' as const,
    plain: false,
    size: 'sm' as const,
  },
  variants: {
    look: {
      default: {
        activeIntent: 'inverse',
        button: 'capitalize font-medium shadow-none transition-colors',
        inactiveIntent: 'ghost',
      },
    },
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
      body: 'text-lg text-inverse-surface/60 leading-relaxed font-medium',
      caption: 'text-sm text-inverse-primary/60 font-mono uppercase tracking-widest',
      display:
        'text-liquid-display font-black leading-compressed tracking-tighter text-inverse-surface font-header',
      headline: 'text-4xl md:text-5xl font-black text-inverse-surface font-header tracking-tight',
      subHeadline: 'text-2xl font-bold text-inverse-surface',
    },
  },
} as const;

const previewStyles = {
  base: 'pt-2 md:pt-4',
  default: {},
  slots: {
    actions: 'flex shrink-0 items-center gap-4 self-start',
    cardPreview: 'p-6 text-center text-sm font-bold flex items-center justify-center min-w-[120px]',
    componentCard:
      'rounded-2xl overflow-hidden transition-all duration-300 bg-transparent border-2 border-inverse-surface/10 shadow-sm hover:border-primary/30 flex flex-col items-center justify-center gap-1 p-2',
    componentCardInner: 'flex flex-col gap-1 w-full',
    componentGrid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
    componentTitle: 'break-words min-w-0',
    componentWrapper: 'flex flex-col gap-2 min-w-0',
    content: 'flex flex-col gap-4 md:gap-6',
    controls: 'flex flex-wrap items-center gap-2 p-1.5 w-fit',
    description: 'max-w-2xl opacity-90',
    divider: 'w-[1px] h-11 bg-inverse-surface mx-1 hidden sm:block',
    groupLabel: 'font-bold uppercase tracking-widest opacity-40',
    groupWrapper: 'flex flex-col gap-1 bg-inverse-primary/10 p-2 rounded-2xl shadow-sm',
    header: 'flex flex-col md:flex-row md:items-start justify-between gap-8',
    headerInfo: 'flex-1 space-y-4 md:space-y-6 pt-2 md:pt-4',
    iconLabel: 'opacity-40',
    iconPreview: 'text-primary',
    section: 'space-y-4',
    sectionHeader: 'flex items-center gap-3',
    swatchColor:
      'w-12 h-12 md:w-16 md:h-16 rounded-xl shadow-sm ring-2 ring-inverse-surface hover:scale-110 hover:shadow-lg transition-transform duration-300 cursor-pointer',
    swatchDivider: 'w-[1px] h-12 md:h-16 bg-inverse-primary mx-1 self-start',
    swatchItem: 'flex flex-col gap-2',
    swatchLabel: 'text-[10px] md:text-xs font-mono text-inverse-surface/60 text-center',
    swatchesContainer: 'flex flex-wrap gap-3 items-start',
    themesContainer: 'space-y-8 md:space-y-12',
    themesGrid: 'grid gap-12',
    themesSection: 'space-y-8',
    themesTitle: 'uppercase tracking-widest opacity-70',
  },
  variants: {
    cardAlignment: {
      block: '!items-stretch',
      inline: '',
    },
    variantItem: {
      block: 'flex flex-col items-stretch w-full gap-1 min-w-0',
      inline: 'flex flex-col items-center gap-1 min-w-0',
    },
    variantList: {
      block: 'flex flex-col items-stretch w-full gap-2 min-w-0',
      inline: 'flex flex-wrap items-end gap-2 min-w-0',
    },
    wrapperWidth: {
      standard: '',
      wide: 'lg:col-span-2',
    },
  },
} as const;

export {
  badgeStyles,
  buttonStyles,
  cardStyles,
  errorBoundaryStyles,
  headerStyles,
  iconStyles,
  inputStyles,
  layoutStyles,
  logoStyles,
  marqueeStyles,
  modeSwitcherStyles,
  previewStyles,
  themeSwitcherStyles,
  typographyStyles,
};
