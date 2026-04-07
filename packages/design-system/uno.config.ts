import {
  type UserConfig,
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';
import { getCSS, getThemes } from './src/utils/theme-generator.ts';

export const unoConfig: UserConfig = {
  preflights: [
    {
      getCSS,
    },
  ],
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
  shortcuts: [
    ['bg-adaptive', 'bg-[var(--primary-adaptive)]'],
    ['bg-adaptive-bg', 'bg-[var(--primary-adaptive)]'],
    ['border-adaptive', 'border-[var(--surface-adaptive)]/10'],
    ['bg-inverse', 'bg-[var(--primary-inverse)]'],
    ['border-inverse', 'border-[var(--surface-inverse)]'],
    ['text-adaptive', 'text-[var(--surface-adaptive)]'],
    ['text-inverse', 'text-[var(--surface-inverse)]'],
    ['text-muted', 'text-[var(--surface-adaptive)]/60'],
    ['text-muted-inverse', 'text-[var(--surface-inverse)]/60'],
    [
      'btn-base',
      'inline-flex items-center justify-center gap-2 font-bold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
    ],
    ['btn-primary', 'btn-base bg-primary text-white hover:scale-110 hover:shadow-glow'],
    [
      'btn-secondary',
      'btn-base bg-surface-adaptive/10 text-adaptive hover:scale-110 hover:bg-surface-adaptive/20',
    ],
    [
      'btn-ghost',
      'btn-base text-adaptive bg-transparent hover:scale-110 hover:bg-primary/10 hover:text-primary hover:shadow-glow',
    ],
    [
      'btn-outline',
      'btn-base border-2 border-primary text-primary hover:scale-110 hover:bg-primary/5 hover:shadow-glow',
    ],
    [
      'btn-premium',
      'btn-base bg-gradient-to-r from-primary to-accent text-white shadow-glow hover:scale-110 hover:shadow-[0_0_40px_rgba(var(--primary-base),0.4)] relative overflow-hidden group',
    ],
    ['glass-nav', 'bg-white dark:bg-black border-b border-adaptive-surface/10 sticky top-0 z-50'],
  ],
  theme: getThemes(),
  transformers: [transformerDirectives(), transformerVariantGroup()],
};

export default defineConfig(unoConfig);
