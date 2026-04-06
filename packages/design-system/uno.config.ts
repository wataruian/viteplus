import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';

export default defineConfig({
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
    presetTypography(),
    presetWebFonts({
      fonts: {
        header: 'Outfit:400,600,700,800',
        mono: 'Fira Code',
        sans: 'Inter:300,400,500,600,700',
      },
    }),
  ],
  rules: [
    [
      /^mask-linear-gradient-(.+)$/,
      ([_ignored, maskDirection]) => ({
        '-webkit-mask-image': `linear-gradient(${maskDirection})`,
        'mask-image': `linear-gradient(${maskDirection})`,
      }),
    ],
    [
      'mask-noise',
      {
        '-webkit-mask-image': `url('https://grainy-gradients.vercel.app/noise.svg')`,
        'mask-image': `url('https://grainy-gradients.vercel.app/noise.svg')`,
      },
    ],
    [
      'border-premium',
      {
        background:
          'linear-gradient(var(--un-bg-opacity, 1), var(--un-bg-opacity, 1)) padding-box, linear-gradient(to bottom right, rgba(255,255,255,0.2), rgba(255,255,255,0.05), rgba(255,255,255,0.15)) border-box',
        'border-color': 'transparent',
      },
    ],
  ],
  shortcuts: [
    [
      'btn-base',
      'px-6 py-3 rounded-2xl font-semibold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2',
    ],
    [
      'btn-primary',
      'btn-base bg-primary-600 text-white hover:bg-primary-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]',
    ],
    [
      'btn-premium',
      'btn-base bg-gradient-to-br from-primary-500 to-indigo-600 text-white hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] hover:scale-105 active:scale-100 relative overflow-hidden',
    ],
    [
      'btn-secondary',
      'btn-base bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20',
    ],
    ['btn-ghost', 'btn-base text-slate-400 hover:text-white hover:bg-white/5'],
    [
      'glass-card',
      'bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-white/20 hover:bg-white/[0.05] transition-all duration-500',
    ],
    ['glass-nav', 'bg-surface-dark/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50'],
    [
      'glass-border',
      'border border-white/10 flex items-center justify-center rounded-2xl bg-white/[0.02]',
    ],
    [
      'text-gradient',
      'bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/30',
    ],
    [
      'text-gradient-primary',
      'bg-clip-text text-transparent bg-gradient-to-br from-primary-300 via-primary-500 to-indigo-600',
    ],
    [
      'text-gradient-accent',
      'bg-clip-text text-transparent bg-gradient-to-br from-accent-300 via-accent-500 to-accent-700',
    ],
    ['glow-text-primary', 'text-shadow-[0_0_20px_rgba(139,92,246,0.5)]'],
    ['section-container', 'max-w-7xl mx-auto px-6 py-24 md:py-32'],
    [
      'nav-link',
      'text-slate-400 hover:text-primary-400 transition-colors duration-300 font-medium',
    ],
    ['shadow-glow', 'shadow-[0_0_35px_rgba(139,92,246,0.3)]'],
    ['bento-grid', 'grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[280px]'],
    ['bento-item', 'glass-card flex flex-col justify-between h-full relative overflow-hidden'],
  ],
  theme: {
    animation: {
      counts: {
        beam: 'infinite',
        float: 'infinite',
        'pulse-slow': 'infinite',
        shimmer: 'infinite',
      },
      durations: {
        beam: '8s',
        'fade-in': '0.8s',
        float: '6s',
        'pulse-slow': '4s',
        reveal: '1s',
        'scroll-left': '20s',
        'scroll-right': '20s',
        shimmer: '2s',
        'slide-up': '0.8s',
      },
      keyframes: {
        beam: '{0%,100%{transform:translateX(-100%);opacity:0}50%{opacity:1}100%{transform:translateX(100%);opacity:0}}',
        'fade-in': '{from{opacity:0}to{opacity:1}}',
        float: '{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}',
        'pulse-slow':
          '{0%,100%{opacity:0.2;transform:scale(1)}50%{opacity:0.4;transform:scale(1.1)}}',
        reveal:
          '{from{opacity:0;transform:translateY(20px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}',
        'scroll-left': '{from{transform:translateX(0)}to{transform:translateX(-100%)}}',
        'scroll-right': '{from{transform:translateX(-100%)}to{transform:translateX(0)}}',
        shimmer: '{from{transform:translateX(-100%)}to{transform:translateX(100%)}}',
        'slide-up':
          '{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}',
      },
      timingFns: {
        beam: 'linear',
        reveal: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
    colors: {
      accent: {
        '300': '#6ee7b7',
        '500': '#10b981',
        '700': '#047857',
        DEFAULT: '#10b981',
      },
      primary: {
        '300': '#c4b5fd',
        '400': '#a78bfa',
        '500': '#8b5cf6',
        '600': '#7c3aed',
        '700': '#6d28d9',
        DEFAULT: '#8b5cf6',
      },
      surface: {
        dark: '#010409',
        lighter: '#161b22',
        muted: '#0d1117',
        overlay: 'rgba(255, 255, 255, 0.04)',
      },
    },
  },
  transformers: [transformerDirectives(), transformerVariantGroup()],
});
