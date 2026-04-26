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
import { animation } from '../tokens/animation';
import { iconsOptions } from '../tokens/icons';
import { shortcuts } from '../utils/shortcuts';
import { webFontsOptions } from '../tokens/typography';

const themes = getThemes();

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
    ...themes,
    animation,
  },
  transformers: [transformerDirectives(), transformerVariantGroup()],
};

const unoCssConfig = defineConfig(unoCssBaseConfig);

export { animation, themes, unoCssBaseConfig, unoCssConfig };
