import { siteConfig } from '@/config/site';
import type { SeoProps } from '@/types/seo';

export interface ResolvedSeo {
  title: string;
  description: string;
  canonicalUrl: string | undefined;
  ogImage: string;
}

/**
 * Resolves page SEO props into final values.
 *
 * `site` is `Astro.site`, now always set (see astro.config.mjs). The
 * `undefined` fallback stays supported so this still degrades gracefully
 * (omits the canonical tag instead of emitting a wrong relative URL) if that
 * ever changes.
 *
 * `ogImage` is resolved against `site` too — Open Graph/Twitter Card images
 * must be absolute URLs, a bare "/branding/logo.svg" isn't valid there even
 * though it works fine as an <img src>.
 */
export function resolveSeo(props: SeoProps, site: URL | undefined): ResolvedSeo {
  const canonicalPath = props.canonicalPath ?? '/';
  const canonicalUrl = site ? new URL(canonicalPath, site).toString() : undefined;
  const ogImagePath = props.image ?? siteConfig.defaultOgImage;

  return {
    title: `${props.title} · ${siteConfig.name}`,
    description: props.description,
    canonicalUrl,
    ogImage: site ? new URL(ogImagePath, site).toString() : ogImagePath,
  };
}
