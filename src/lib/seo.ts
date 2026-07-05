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
 * `site` is `Astro.site` — it stays `undefined` until astro.config.mjs
 * declares a `site` URL (deliberately deferred until the domain/repo is
 * final, see STACK_DECISIONS.md). Until then the canonical tag is omitted
 * rather than emitting an incorrect relative URL.
 */
export function resolveSeo(props: SeoProps, site: URL | undefined): ResolvedSeo {
  const canonicalPath = props.canonicalPath ?? '/';
  const canonicalUrl = site ? new URL(canonicalPath, site).toString() : undefined;

  return {
    title: `${props.title} · ${siteConfig.name}`,
    description: props.description,
    canonicalUrl,
    ogImage: props.image ?? siteConfig.defaultOgImage,
  };
}
