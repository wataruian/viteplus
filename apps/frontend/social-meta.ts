import type { HtmlTagDescriptor, Plugin } from 'vite-plus';

const shareImagePath = '/og-image.png';
const shareImageWidth = 1200;
const shareImageHeight = 630;
const shareImageAlt = 'Vite+ Monorepo Starter frontend';

const resolveSiteUrl = (rawUrl: string | undefined): URL | undefined => {
  const trimmed = rawUrl?.trim() ?? '';
  if (trimmed === '') {
    return undefined;
  }

  const url = globalThis.URL.parse(trimmed.endsWith('/') ? trimmed : `${trimmed}/`);
  if (url === null) {
    throw new Error(`ADMIN_URL / VITE_ADMIN_URL must be an absolute URL, got: ${trimmed}`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`ADMIN_URL / VITE_ADMIN_URL must use http(s), got: ${trimmed}`);
  }

  return url;
};

const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({
  attrs,
  injectTo: 'head',
  tag: 'meta',
});

const socialMetaTags = (siteUrl: URL | undefined): HtmlTagDescriptor[] => {
  if (siteUrl === undefined) {
    return [];
  }

  const imageUrl = new globalThis.URL(shareImagePath, siteUrl).href;

  return [
    meta({ content: siteUrl.href, property: 'og:url' }),
    meta({ content: imageUrl, property: 'og:image' }),
    meta({ content: String(shareImageWidth), property: 'og:image:width' }),
    meta({ content: String(shareImageHeight), property: 'og:image:height' }),
    meta({ content: shareImageAlt, property: 'og:image:alt' }),
    meta({ content: imageUrl, name: 'twitter:image' }),
    meta({ content: shareImageAlt, name: 'twitter:image:alt' }),
  ];
};

const summaryCard = '<meta name="twitter:card" content="summary" />';
const largeImageCard = '<meta name="twitter:card" content="summary_large_image" />';

const transformSocialMetaHtml = (
  siteUrl: URL | undefined,
  html: string,
): { html: string; tags: HtmlTagDescriptor[] } => ({
  html: siteUrl === undefined ? html : html.replace(summaryCard, largeImageCard),
  tags: socialMetaTags(siteUrl),
});

const createSocialMetaTransform = (siteUrl: URL | undefined) => (html: string) =>
  transformSocialMetaHtml(siteUrl, html);

const socialMeta = (rawSiteUrl: string | undefined): Plugin => ({
  name: 'lightproject:social-meta',
  transformIndexHtml: createSocialMetaTransform(resolveSiteUrl(rawSiteUrl)),
});

export {
  createSocialMetaTransform,
  meta,
  resolveSiteUrl,
  shareImageHeight,
  shareImagePath,
  shareImageWidth,
  socialMeta,
  socialMetaTags,
  transformSocialMetaHtml,
};
