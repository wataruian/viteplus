import { type UserConfig, createGenerator } from 'unocss';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { createUnoConfig, unoCssBaseConfig, unoCssConfig } from '../../src/configs/unocss';
import { getCSS } from '../../src/utils/theme-generator';

describe('unoCssBaseConfig', () => {
  test('builds a deduped, non-empty safelist from base styles, intents, and the compiled styles registry', () => {
    const { safelist } = unoCssBaseConfig;
    expect(Array.isArray(safelist)).toBe(true);
    if (Array.isArray(safelist)) {
      expect(safelist.length).toBeGreaterThan(0);
      expect(new Set(safelist).size).toBe(safelist.length);
      for (const entry of safelist) {
        expect(typeof entry).toBe('string');
        if (typeof entry === 'string') {
          expect(entry.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('composes the theme from token modules with colors, animation, borderRadius, and spacing', () => {
    const { theme } = unoCssBaseConfig;
    expect(theme !== undefined && typeof theme === 'object').toBe(true);
    expect(theme !== undefined && 'colors' in theme).toBe(true);
    expect(theme !== undefined && 'animation' in theme).toBe(true);
    expect(theme !== undefined && 'borderRadius' in theme).toBe(true);
    expect(theme !== undefined && 'spacing' in theme).toBe(true);

    if (theme !== undefined && 'colors' in theme) {
      const { colors } = theme;
      expect(colors !== undefined && colors !== null && typeof colors === 'object').toBe(true);
      if (colors !== undefined && colors !== null && typeof colors === 'object') {
        expect('primary' in colors).toBe(true);
        expect('accent' in colors).toBe(true);
      }
    }
  });

  test('registers the presets, transformers, and shortcuts used by the design system', () => {
    expect(unoCssBaseConfig.presets?.length).toBeGreaterThan(0);
    expect(unoCssBaseConfig.transformers?.length).toBeGreaterThan(0);
    expect(unoCssBaseConfig.shortcuts).toStrictEqual({});
  });

  test('provides a single preflight backed by the theme CSS generator', () => {
    const { preflights } = unoCssBaseConfig;
    expect(preflights?.length).toBe(1);
    expect(typeof preflights?.[0]?.getCSS).toBe('function');
  });

  test('excludes build output and vcs directories from the content pipeline', () => {
    const pipeline = unoCssBaseConfig.content?.pipeline;
    const exclude = typeof pipeline === 'object' ? pipeline.exclude : undefined;
    expect(Array.isArray(exclude)).toBe(true);

    if (Array.isArray(exclude)) {
      expect(exclude.length).toBeGreaterThan(0);
      expect(
        exclude.some((pattern: string | RegExp) => `${pattern}`.includes('node_modules')),
      ).toBe(true);
      expect(exclude.some((pattern: string | RegExp) => `${pattern}`.includes('dist'))).toBe(true);
    }
  });
});

describe('unoCssConfig', () => {
  test('is the resolved defineConfig wrapper around unoCssBaseConfig', () => {
    expect(unoCssConfig.safelist).toStrictEqual(unoCssBaseConfig.safelist);
    expect(unoCssConfig.shortcuts).toStrictEqual(unoCssBaseConfig.shortcuts);
  });
});

const generatedCss = async (config: UserConfig) => {
  const generator = await createGenerator(config);
  const { css } = await generator.generate('', { minify: false, preflights: true });
  return css;
};

describe('createUnoConfig', () => {
  test('emits the default themes when no themes are passed', async () => {
    const css = await generatedCss(createUnoConfig());

    expect(css).toContain(getCSS().trim());
    await expect(generatedCss(unoCssConfig)).resolves.toContain(getCSS().trim());
    await expect(generatedCss(unoCssBaseConfig)).resolves.toContain(getCSS().trim());
  });

  test("emits the app's themes in place of the defaults", async () => {
    const themes = { brand: { accent: '#f59e0b', primary: '#0f766e' } };

    const css = await generatedCss(createUnoConfig({ themes }));

    expect(css).toContain(getCSS(themes).trim());
    expect(css).not.toContain('.emerald');
  });

  test('puts defaultTheme on :root', async () => {
    const themes = {
      autumn: { accent: '#65a30d', primary: '#b45309' },
      summer: { accent: '#06b6d4', primary: '#f97316' },
    };

    const css = await generatedCss(createUnoConfig({ defaultTheme: 'summer', themes }));

    expect(css).toContain(getCSS(themes, 'summer').trim());
    expect(() => createUnoConfig({ defaultTheme: 'winter', themes })).toThrow(
      'defaultTheme "winter" is not one of: autumn, summer',
    );
  });

  test('fails when the config is created, not when a page is styled', () => {
    expect(() => createUnoConfig({ themes: {} })).toThrow('Define at least one theme');
  });

  test('keeps everything else from the base config', () => {
    const config = createUnoConfig({
      themes: { brand: { accent: '#000000', primary: '#0f766e' } },
    });

    expect(config.safelist).toStrictEqual(unoCssBaseConfig.safelist);
    expect(config.theme).toStrictEqual(unoCssBaseConfig.theme);
    expect(config.presets).toBe(unoCssBaseConfig.presets);
  });
});

describe('resolvedWebFontsOptions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('disables the web fonts provider under Vitest, to avoid a real network fetch', async () => {
    vi.stubEnv('VITEST', 'true');
    vi.resetModules();
    const { resolvedWebFontsOptions } = await import('../../src/configs/unocss');

    expect(resolvedWebFontsOptions.provider).toBe('none');
  });

  test('leaves the real provider untouched outside Vitest', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.resetModules();
    const { resolvedWebFontsOptions } = await import('../../src/configs/unocss');

    expect(resolvedWebFontsOptions.provider).toBeUndefined();
  });
});
