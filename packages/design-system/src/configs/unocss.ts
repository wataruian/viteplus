// import * as registry from '../components';
import { type ColorKeyMap, baseStyles, intentInput, intentSoft, intentSolid } from '../tokens/base';
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
import { getStyles, shortcuts } from '../utils';
import { animation } from '../tokens/animation';
import { iconsOptions } from '../tokens/icons';
import { webFontsOptions } from '../tokens/typography';

const themes = getThemes();

const semanticColors: ColorKeyMap[] = ['primary', 'accent', 'success', 'warning', 'danger', 'info'];

const intentClasses: string[] = [];
for (const color of semanticColors) {
  intentClasses.push(...intentSoft(color).split(' '));
  intentClasses.push(...intentSolid(color).split(' '));
}
intentClasses.push(...intentInput('danger').split(' '), ...intentInput('success').split(' '));

const safelist = [...getStyles(baseStyles).split(' '), ...intentClasses];

// const styles = Object.fromEntries(
//   Object.entries(registry).filter(([key]) => key.endsWith('Styles')),
// );

// const safelist = [...getStyles(baseStyles).split(' '), ...intentClasses, ...getStyles(styles)];

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
  safelist,
  shortcuts,
  theme: {
    ...themes,
    animation,
  },
  transformers: [transformerDirectives(), transformerVariantGroup()],
};

const unoCssConfig = defineConfig(unoCssBaseConfig);

export { animation, themes, unoCssBaseConfig, unoCssConfig };
