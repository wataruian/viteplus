import { describe, expect, test } from 'vite-plus/test';

import {
  createSocialMetaTransform,
  resolveSiteUrl,
  socialMeta,
  socialMetaTags,
  transformSocialMetaHtml,
} from '../../social-meta';

const summaryCard = '<meta name="twitter:card" content="summary" />';
const largeImageCard = '<meta name="twitter:card" content="summary_large_image" />';

describe('resolveSiteUrl', () => {
  test('is undefined when the URL is unset or blank', () => {
    expect(resolveSiteUrl(undefined)).toBeUndefined();
    expect(resolveSiteUrl('   ')).toBeUndefined();
  });

  test('normalizes to a trailing slash', () => {
    expect(resolveSiteUrl('https://app.example.com')?.href).toBe('https://app.example.com/');
    expect(resolveSiteUrl(' https://app.example.com/ ')?.href).toBe('https://app.example.com/');
  });

  test('rejects relative and non-http(s) URLs', () => {
    expect(() => resolveSiteUrl('/relative')).toThrow('must be an absolute URL');
    expect(() => resolveSiteUrl('ftp://example.com')).toThrow('must use http(s)');
  });
});

describe('socialMetaTags', () => {
  test('emits nothing without a site URL', () => {
    expect(socialMetaTags(undefined)).toStrictEqual([]);
  });

  test('emits absolute og:url and og:image/twitter:image URLs', () => {
    const tags = socialMetaTags(resolveSiteUrl('https://app.example.com'));
    const content = (key: string) =>
      tags.find((tag) => tag.attrs?.['property'] === key || tag.attrs?.['name'] === key)?.attrs?.[
        'content'
      ];

    expect(content('og:url')).toBe('https://app.example.com/');
    expect(content('og:image')).toBe('https://app.example.com/og-image.png');
    expect(content('og:image:width')).toBe('1200');
    expect(content('og:image:height')).toBe('630');
    expect(content('twitter:image')).toBe('https://app.example.com/og-image.png');
    expect(tags.every((tag) => tag.tag === 'meta' && tag.injectTo === 'head')).toBe(true);
  });
});

describe('transformSocialMetaHtml', () => {
  test('leaves index.html untouched without a site URL', () => {
    expect(transformSocialMetaHtml(undefined, summaryCard)).toStrictEqual({
      html: summaryCard,
      tags: [],
    });
  });

  test('upgrades the twitter card and injects the tags with a site URL', () => {
    const result = transformSocialMetaHtml(resolveSiteUrl('https://app.example.com'), summaryCard);

    expect(result.html).toBe(largeImageCard);
    expect(result.tags).toHaveLength(7);
  });
});

describe('createSocialMetaTransform', () => {
  test('is the transformIndexHtml hook the plugin installs', () => {
    const transform = createSocialMetaTransform(resolveSiteUrl('https://app.example.com'));

    expect(transform(summaryCard).html).toBe(largeImageCard);
    expect(createSocialMetaTransform(undefined)(summaryCard).tags).toStrictEqual([]);
  });
});

describe('socialMeta plugin', () => {
  test('is a named Vite plugin that validates the URL eagerly', () => {
    expect(socialMeta(undefined).name).toBe('lightproject:social-meta');
    expect(() => socialMeta('not a url')).toThrow('must be an absolute URL');
  });
});
