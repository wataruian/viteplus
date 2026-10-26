import type { HtmlTagDescriptor, Plugin } from 'vite-plus';

const shareImagePath = '/og-image.png';
const shareImageWidth = 1200;
const shareImageHeight = 630;
const shareImageAlt = 'Vite+ Monorepo Starter frontend';

const resolveWebsiteUrl = (rawUrl: string | undefined): URL | undefined => {
  const trimmed = rawUrl?.trim() ?? '';
  if (trimmed === '') {
    return undefined;
  }

  const url = globalThis.URL.parse(trimmed.endsWith('/') ? trimmed : `${trimmed}/`);
  if (url === null) {
    throw new Error(`FRONTEND_URL / VITE_FRONTEND_URL must be an absolute URL, got: ${trimmed}`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`FRONTEND_URL / VITE_FRONTEND_URL must use http(s), got: ${trimmed}`);
  }

  return url;
};

const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({
  attrs,
  injectTo: 'head',
  tag: 'meta',
});

const socialMetaTags = (websiteUrl: URL | undefined): HtmlTagDescriptor[] => {
  if (websiteUrl === undefined) {
    return [];
  }

  const imageUrl = new globalThis.URL(shareImagePath, websiteUrl).href;

  return [
    meta({ content: websiteUrl.href, property: 'og:url' }),
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
  websiteUrl: URL | undefined,
  html: string,
): { html: string; tags: HtmlTagDescriptor[] } => ({
  html: websiteUrl === undefined ? html : html.replace(summaryCard, largeImageCard),
  tags: socialMetaTags(websiteUrl),
});

const createSocialMetaTransform = (websiteUrl: URL | undefined) => (html: string) =>
  transformSocialMetaHtml(websiteUrl, html);

const socialMeta = (rawWebsiteUrl: string | undefined): Plugin => ({
  name: 'lightproject:social-meta',
  transformIndexHtml: createSocialMetaTransform(resolveWebsiteUrl(rawWebsiteUrl)),
});

export {
  createSocialMetaTransform,
  largeImageCard,
  meta,
  resolveWebsiteUrl,
  shareImageAlt,
  shareImageHeight,
  shareImagePath,
  shareImageWidth,
  socialMeta,
  socialMetaTags,
  summaryCard,
  transformSocialMetaHtml,
};
