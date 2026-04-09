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
import { getCSS, getThemes } from '../utils/theme-generator';
import { lineHeights, webFontsOptions } from '../tokens/typography';
import { iconsOptions } from '../tokens/icons';
import { motion } from '../tokens/effects';
import { shortcuts } from '../utils/styles';
import { spacing } from '../tokens/spacing';

const unoCssBaseConfig: UserConfig = {
  content: {
    pipeline: {
      include: [
        /\.(vue|svelte|[jt]sx|mdx?|html)($|\?)/,
        'src/**/*.{js,ts,jsx,tsx}',
        '**/*.{js,ts,jsx,tsx}',
      ],
    },
  },
  preflights: [
    {
      getCSS,
    },
  ],
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons(iconsOptions),
    presetTypography(),
    presetWebFonts(webFontsOptions),
  ],
  shortcuts,
  theme: {
    ...getThemes(),
    animation: {
      counts: {
        marquee: 'infinite',
      },
      durations: {
        marquee: 'var(--duration, 40s)',
      },
      keyframes: motion.animations,
      timingFns: {
        marquee: 'linear',
      },
    },
    colors: {
      ...getThemes().colors,
      'adaptive-bg': 'var(--color-bg)',
      'adaptive-bg-alt': 'var(--color-bg-alt)',
      'adaptive-border': 'var(--color-border)',
      'adaptive-muted': 'var(--color-text-muted)',
      'adaptive-text': 'var(--color-text)',
      inverse: 'var(--color-inverse)',
    },
    fontSize: {
      'liquid-display': 'min(120px,12vw)',
    },
    lineHeight: {
      compressed: lineHeights.compressed,
    },
    maxWidth: {
      layout: spacing.layoutMax,
    },
  },
  transformers: [transformerDirectives(), transformerVariantGroup()],
};

const unoCssConfig = defineConfig(unoCssBaseConfig);

export { unoCssBaseConfig, unoCssConfig };
