import {
  type ASTNode,
  compileStylesRegistry,
  extractStylesFromFile,
} from '../utils/style-compiler';
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
import { animation } from '../tokens/animation';
import fg from 'fast-glob';
import { getStyles } from '../utils/helpers';
import { iconsOptions } from '../tokens/icons';
import path from 'node:path';
import { shortcuts } from '../utils/shortcuts';
import { webFontsOptions } from '../tokens/typography';

const themes = getThemes();

const semanticColors: ColorKeyMap[] = ['primary', 'accent', 'success', 'warning', 'danger', 'info'];

const intentClasses: string[] = [];
for (const color of semanticColors) {
  intentClasses.push(...intentSoft(color).split(' '));
  intentClasses.push(...intentSolid(color).split(' '));
}

intentClasses.push(...intentInput('danger').split(' '), ...intentInput('success').split(' '));

const componentsGlob = path.resolve(import.meta.dirname, '../components/**/*.tsx');

const files = fg.globSync(componentsGlob);

const raw: Record<string, ASTNode> = {};
for (const file of files) {
  Object.assign(raw, extractStylesFromFile(file));
}

const stylesRegistry = compileStylesRegistry(raw);

const safelist = [
  ...new Set(
    [
      ...getStyles(baseStyles).split(' '),
      ...intentClasses,
      ...getStyles(stylesRegistry).split(' '),
    ].filter(Boolean),
  ),
];

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

export { unoCssBaseConfig, unoCssConfig };
