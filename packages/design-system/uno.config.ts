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
import { iconsOptions, shortcuts, webFontsOptions } from './src/utils/styles.ts';

export const unoConfig: UserConfig = {
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
  theme: getThemes(),
  transformers: [transformerDirectives(), transformerVariantGroup()],
};

export default defineConfig(unoConfig);
