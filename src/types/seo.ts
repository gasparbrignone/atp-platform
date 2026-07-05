export interface SeoProps {
  /** Page-specific title, combined with the site name. */
  title: string;
  /** Short, accurate description used for search results and social previews. */
  description: string;
  /** Path (not full URL) used to build the canonical link, e.g. "/" or "/biblioteca". */
  canonicalPath?: string;
  /** Absolute or root-relative path to the social preview image. */
  image?: string;
}
