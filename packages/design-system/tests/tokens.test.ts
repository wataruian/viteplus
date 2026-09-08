import { describe, expect, test } from 'vite-plus/test';

import { animation } from '../src/tokens/animation';
import { breakpoints } from '../src/tokens/breakpoints';
import { blurs, glassmorphism, glows, motion, shadows } from '../src/tokens/effects';
import { iconsOptions } from '../src/tokens/icons';
import { borderRadius, spacing } from '../src/tokens/spacing';
import {
  fontSizes,
  fontWeights,
  fonts,
  letterSpacings,
  lineHeights,
  webFontsOptions,
} from '../src/tokens/typography';

describe('animation tokens', () => {
  test('defines matching keys across counts, durations, keyframes, and timingFns', () => {
    const groups = [
      animation.counts,
      animation.durations,
      animation.keyframes,
      animation.timingFns,
    ];
    const keys = ['gradient', 'marquee', 'marquee-reverse'];
    for (const group of groups) {
      expect(Object.keys(group).toSorted()).toStrictEqual(keys.toSorted());
    }
  });

  test('every keyframe string is a brace-delimited block', () => {
    for (const keyframe of Object.values(animation.keyframes)) {
      expect(keyframe.startsWith('{')).toBe(true);
      expect(keyframe.endsWith('}')).toBe(true);
    }
  });
});

describe('breakpoints tokens', () => {
  test('defines the standard set of pixel breakpoints in ascending order', () => {
    expect(breakpoints).toStrictEqual({
      '2xl': '1536px',
      lg: '1024px',
      md: '768px',
      sm: '640px',
      xl: '1280px',
    });
  });
});

describe('effects tokens', () => {
  test('blurs defines a default plus named sizes', () => {
    expect(blurs.default).toBe('8px');
    expect(Object.keys(blurs)).toContain('lg');
  });

  test('glassmorphism defines a bg/blur/border triplet for each look', () => {
    for (const look of Object.values(glassmorphism)) {
      expect(look).toHaveProperty('bg');
      expect(look).toHaveProperty('blur');
      expect(look).toHaveProperty('border');
    }
  });

  test('glows references the matching CSS variable for each semantic color', () => {
    expect(glows.primary).toContain('--primary-base');
    expect(glows.accent).toContain('--accent-base');
    expect(glows.danger).toContain('--danger-base');
  });

  test('motion defines animations, durations, and easings', () => {
    expect(motion.animations.marquee).toContain('translateX');
    expect(motion.durations.fast).toBe('150ms');
    expect(motion.easings.inOut).toMatch(/^cubic-bezier/u);
  });

  test('shadows defines a default plus named sizes', () => {
    expect(shadows.default).toContain('rgba');
    expect(Object.keys(shadows)).toContain('2xl');
  });
});

describe('icons tokens', () => {
  test('configures the ph collection loader and base options', () => {
    expect(iconsOptions.scale).toBe(1.2);
    expect(iconsOptions.warn).toBe(true);
    expect(iconsOptions.collections).toHaveProperty('ph');
  });

  test('the ph collection loader resolves an iconify JSON payload', async () => {
    const loader = iconsOptions.collections?.['ph'];
    expect(typeof loader).toBe('function');
    if (typeof loader === 'function') {
      const icons = await loader('house');
      expect(icons).toHaveProperty('icons');
    }
  });
});

describe('spacing tokens', () => {
  test('borderRadius defines a default plus named sizes', () => {
    expect(borderRadius.default).toBe('0.25rem');
    expect(borderRadius.full).toBe('9999rem');
  });

  test('spacing defines the numeric scale and semantic layout aliases', () => {
    expect(spacing['4']).toBe('1rem');
    expect(spacing.layoutMax).toBe('87.5rem');
    expect(Object.keys(spacing)).toContain('layoutXs');
  });
});

describe('typography tokens', () => {
  test('fonts defines header, mono, and sans stacks', () => {
    expect(fonts.sans).toContain('Inter');
    expect(fonts.header).toContain('Outfit');
    expect(fonts.mono).toContain('Fira Code');
  });

  test('fontSizes defines the named scale', () => {
    expect(fontSizes.base).toBe('1rem');
    expect(fontSizes.liquidDisplay).toContain('vw');
  });

  test('fontWeights defines the named weight scale', () => {
    expect(fontWeights.normal).toBe('400');
    expect(fontWeights.black).toBe('900');
  });

  test('letterSpacings and lineHeights define their named scales', () => {
    expect(letterSpacings.normal).toBe('0em');
    expect(lineHeights.normal).toBe('1.5');
  });

  test('webFontsOptions declares weighted font families matching the fonts token', () => {
    expect(webFontsOptions.fonts?.['sans']).toContain('Inter');
    expect(webFontsOptions.fonts?.['header']).toContain('Outfit');
    expect(webFontsOptions.fonts?.['mono']).toBe('Fira Code');
  });
});
