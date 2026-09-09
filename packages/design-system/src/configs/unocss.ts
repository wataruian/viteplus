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

import { animation } from '../tokens/animation';
import { type ColorKeyMap, baseStyles, intentInput, intentSoft, intentSolid } from '../tokens/base';
import { iconsOptions } from '../tokens/icons';
import { borderRadius, spacing } from '../tokens/spacing';
import { webFontsOptions } from '../tokens/typography';
import { stylesRegistry } from '../utils/compile';
import { getStyles } from '../utils/helpers';
import { shortcuts } from '../utils/shortcuts';
import { getCSS, getThemes } from '../utils/theme-generator';

const isVitest =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    'VITEST'
  ] === 'true';

const resolvedWebFontsOptions = isVitest
  ? { ...webFontsOptions, provider: 'none' as const }
  : webFontsOptions;

const themes = getThemes();

const semanticColors: ColorKeyMap[] = ['primary', 'accent', 'success', 'warning', 'danger', 'info'];

const intentClasses: string[] = [];
for (const color of semanticColors) {
  intentClasses.push(...intentSoft(color).split(' '), ...intentSolid(color).split(' '));
}

intentClasses.push(...intentInput('danger').split(' '), ...intentInput('success').split(' '));

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
      exclude: [
        /[\\/]node_modules[\\/]/u,
        /[\\/]\.git[\\/]/u,
        /[\\/]dist[\\/]/u,
        /[\\/]out[\\/]/u,
        /[\\/]storybook-static[\\/]/u,
        /[\\/]\.wrangler[\\/]/u,
        /[\\/]\.dagger[\\/]/u,
        /[\\/]\.pruned[\\/]/u,
      ],
      include: [/\.(?:vue|svelte|[jt]sx|mdx?|html)(?:$|\?)/u, '**/*.{js,ts,jsx,tsx}'],
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
    presetWebFonts(resolvedWebFontsOptions),
  ],
  safelist,
  shortcuts,
  theme: {
    ...themes,
    animation,
    borderRadius,
    spacing,
  },
  transformers: [transformerDirectives(), transformerVariantGroup()],
};

const unoCssConfig = defineConfig(unoCssBaseConfig);

export { resolvedWebFontsOptions, unoCssBaseConfig, unoCssConfig };
