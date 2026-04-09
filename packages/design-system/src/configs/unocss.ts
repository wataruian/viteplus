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
import { iconsOptions } from '../tokens/icons';
import { motion } from '../tokens/effects';
import { shortcuts } from '../utils/styles';
import { webFontsOptions } from '../tokens/typography';

const unoCssBaseConfig: UserConfig = {
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
  },
  transformers: [transformerDirectives(), transformerVariantGroup()],
};

const unoCssConfig = defineConfig(unoCssBaseConfig);

export { unoCssBaseConfig, unoCssConfig };
