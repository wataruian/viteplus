import { glows } from './effects';

/**
 * Master Variant Engine
 *
 * Centralizes all component-level variant definitions.
 * Components should import these modules to quickly define their CVAs.
 */

// ─── Constants for Iteration ────────────────────────────────────────────────

const badgeIntents = [
  'primary',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'glass',
  'outline',
] as const;
const badgeSizes = ['sm', 'md', 'lg'] as const;

const buttonIntents = [
  'primary',
  'accent',
  'secondary',
  'premium',
  'glass',
  'outline',
  'ghost',
  'danger',
] as const;
const buttonSizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;

const cardIntents = ['premium', 'glass', 'outline', 'default'] as const;

// ─── Badge Styles ────────────────────────────────────────────────────────────

const badgeStyles = {
  base: 'inline-flex items-center justify-center font-black uppercase tracking-widest border transition-all duration-300',
  defaultVariants: {
    intent: 'primary',
    size: 'md',
  } as const,
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
  } as const,
};

// ─── Button Styles ───────────────────────────────────────────────────────────

const buttonStyles = {
  base: 'inline-flex items-center justify-center font-bold tracking-tight transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
  defaultVariants: {
    intent: 'primary',
    size: 'md',
  } as const,
  variants: {
    intent: {
      accent: `bg-accent text-white hover:${glows.accent}`,
      danger: `bg-danger text-white hover:${glows.danger}`,
      ghost: 'bg-transparent text-slate-400 hover:bg-white/5',
      glass: 'bg-white/5 text-white border border-white/10 backdrop-blur-md',
      outline: 'bg-transparent text-slate-300 border border-white/10 hover:border-white/20',
      premium:
        'bg-gradient-to-r from-primary to-accent text-white hover:scale-105 hover:shadow-[0_0_30px_rgba(var(--primary-base),0.3)]',
      primary: `bg-primary text-white hover:${glows.primary}`,
      secondary: 'bg-white/5 text-slate-300 hover:bg-white/10',
    },
    size: {
      '2xl': 'h-16 px-10 text-xl rounded-2xl',
      lg: 'h-14 px-8 text-lg rounded-xl',
      md: 'h-12 px-6 text-base rounded-lg',
      sm: 'h-10 px-4 text-sm rounded-md',
      xl: 'h-15 px-9 text-xl rounded-xl',
      xs: 'h-8 px-3 text-xs rounded',
    },
  } as const,
};

// ─── Card Styles ─────────────────────────────────────────────────────────────

const cardStyles = {
  base: 'rounded-2xl overflow-hidden transition-all duration-300',
  defaultVariants: {
    intent: 'premium',
  } as const,
  variants: {
    intent: {
      default: 'bg-white/5 border border-white/10',
      glass: 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl',
      outline: 'bg-transparent border border-white/10 hover:border-primary/30',
      premium:
        'bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl',
    },
  } as const,
};

// ─── Common Utility Fragments ───────────────────────────────────────────────────────

const commonStates = {
  active: 'ring-2 ring-primary/50 border-primary/50 bg-primary/10',
  disabled: 'opacity-50 cursor-not-allowed grayscale pointer-events-none',
  error: 'border-danger/50 focus:border-danger/50 focus:ring-danger/10 text-danger-400',
  loading: 'opacity-70 pointer-events-none cursor-wait',
};

// ─── Feature Styles ──────────────────────────────────────────────────────────

const featureStyles = {
  logo: {
    bottom: 'text-2xl tracking-tighter text-white',
    inner: 'flex flex-col items-start leading-compressed',
    root: 'flex items-center gap-2 font-black',
    top: 'text-primary',
  },
  marquee: {
    animLeft: 'animate-marquee',
    animRight: 'animate-marquee-reverse',
    root: 'flex select-none overflow-hidden gap-4',
    track: 'flex shrink-0 items-center justify-around gap-4 min-w-full',
    trackPause: 'hover:[animation-play-state:paused]',
  },
};

// ─── Icon Styles ─────────────────────────────────────────────────────────────

const iconStyles = {
  moon: 'i-ph-moon-bold',
  sun: 'i-ph-sun-bold',
};

// ─── Input Styles ────────────────────────────────────────────────────────────

const inputStyles = {
  base: 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
  defaultVariants: {
    state: 'default',
  } as const,
  variants: {
    state: {
      default: '',
      error: 'border-danger/50 focus:ring-danger/20 focus:border-danger/50',
      success: 'border-success/50 focus:ring-success/20 focus:border-success/50',
    },
  } as const,
};

// ─── Layout Styles ───────────────────────────────────────────────────────────

const layoutStyles = {
  appRoot: 'min-h-screen font-sans',
  container: 'max-w-layout mx-auto px-6 md:px-10',
  header:
    'fixed top-0 left-0 right-0 z-50 h-20 bg-black/40 backdrop-blur-xl border-b border-white/5',
  headerInner: 'h-full flex items-center justify-between',
  section: 'py-24 md:py-40 relative overflow-hidden',
};

// ─── Typography Styles ───────────────────────────────────────────────────────

const typographyStyles = {
  body: 'text-lg text-slate-400 leading-relaxed font-medium',
  caption: 'text-sm text-slate-500 font-mono uppercase tracking-widest',
  display:
    'text-liquid-display font-black leading-compressed tracking-tighter text-white font-header',
  headline: 'text-4xl md:text-5xl font-black text-white font-header tracking-tight',
  subheadline: 'text-2xl font-bold text-white',
};

// ─── Preview Content ─────────────────────────────────────────────────────────

const previewContent = {
  cardContent: {
    accent: 'Accent',
    danger: 'Danger',
    glass: 'Glass',
    primary: 'Primary',
    success: 'Success',
    warning: 'Warning',
  },
  cardTitles: {
    badges: 'Badges',
    buttons: 'Buttons',
    typography: 'Typography',
  },
  heroBadge: 'Vite+ Design System',
  heroCtaPrimary: 'Get Started',
  heroCtaSecondary: 'Documentation',
  heroDescription:
    'A token-first, 100% pure design system built on top of UnoCSS and React. Experience the power of zero-volatility builds and premium aesthetics.',
  heroTitleEmphasis: 'Frontend',
  heroTitlePrefix: 'The Future of ',
  heroTitleSuffix: ' Purity.',
  marqueeItems: ['VITE+', 'OXC', 'UNOCSS', 'REACT'],
  typoBody: 'Body content with relaxed leading.',
  typoCaption: 'Caption Text',
};

// ─── Preview Styles ──────────────────────────────────────────────────────────

const previewStyles = {
  componentList: 'flex flex-wrap gap-4',
  heroActions: 'flex items-center gap-4',
  heroBadgeIntent: 'accent' as const,
  heroBadgeSize: 'lg' as const,
  heroBody: `${typographyStyles.body} max-w-2xl`,
  heroButtonPrimaryIntent: 'premium' as const,
  heroButtonPrimarySize: 'lg' as const,
  heroButtonSecondaryIntent: 'outline' as const,
  heroButtonSecondarySize: 'lg' as const,
  heroContent: 'flex flex-col items-center text-center space-y-8',
  heroEmphasis: 'text-primary',
  heroSection: 'pt-40',
  marqueeDirection: 'left' as const,
  marqueeItem: 'flex items-center gap-8 mx-4',
  marqueeSpeed: 60,
  marqueeWrapper: 'border-y border-white/5 py-4',
  root: 'space-y-40 pb-40', // Increased spacing for gallery
  showcaseBadgeDangerIntent: 'danger' as const,
  showcaseBadgeSuccessIntent: 'success' as const,
  showcaseBadgeWarningIntent: 'warning' as const,
  showcaseButtonAccentIntent: 'accent' as const,
  showcaseButtonGlassIntent: 'glass' as const,
  showcaseButtonPrimaryIntent: 'primary' as const,
  showcaseCard: 'p-8 space-y-6',
  showcaseCardGlassIntent: 'glass' as const,
  showcaseCardOutlineIntent: 'outline' as const,
  showcaseCardPremiumIntent: 'premium' as const,
  showcaseCount: 6,
  showcaseGrid: 'grid md:grid-cols-2 lg:grid-cols-3 gap-8',
};

// ─── Exports ───────────────────────────────────────────────────────

export {
  badgeIntents,
  badgeSizes,
  badgeStyles,
  buttonIntents,
  buttonSizes,
  buttonStyles,
  cardIntents,
  cardStyles,
  commonStates,
  featureStyles,
  iconStyles,
  inputStyles,
  layoutStyles,
  typographyStyles,
  previewContent,
  previewStyles,
};
