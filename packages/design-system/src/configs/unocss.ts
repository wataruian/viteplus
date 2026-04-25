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
import { shortcuts } from '../utils/shortcuts';
import { webFontsOptions } from '../tokens/typography';

const unoCssBaseConfig: UserConfig = {
  content: {
    pipeline: {
      exclude: [/[\\/]node_modules[\\/]/, /[\\/]\.git[\\/]/, /[\\/]dist[\\/]/],
      include: [/\.(vue|svelte|[jt]sx|mdx?|html)($|\?)/, '**/*.{js,ts,jsx,tsx}'],
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
        gradient: 'infinite',
      },
      durations: {
        gradient: '3s',
      },
      keyframes: {
        gradient:
          '{0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;}}',
      },
      timingFns: {
        gradient: 'ease',
      },
    },
  },
  transformers: [transformerDirectives(), transformerVariantGroup()],
};

const unoCssConfig = defineConfig(unoCssBaseConfig);

export { unoCssBaseConfig, unoCssConfig };
