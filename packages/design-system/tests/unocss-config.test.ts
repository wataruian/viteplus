import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

import { unoCssBaseConfig, unoCssConfig } from '../src/configs/unocss';

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

describe('resolvedWebFontsOptions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('disables the web fonts provider under Vitest, to avoid a real network fetch', async () => {
    vi.stubEnv('VITEST', 'true');
    vi.resetModules();
    const { resolvedWebFontsOptions } = await import('../src/configs/unocss');

    expect(resolvedWebFontsOptions.provider).toBe('none');
  });

  test('leaves the real provider untouched outside Vitest', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.resetModules();
    const { resolvedWebFontsOptions } = await import('../src/configs/unocss');

    expect(resolvedWebFontsOptions.provider).toBeUndefined();
  });
});
