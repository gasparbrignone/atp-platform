/**
 * Naming convention shared with scripts/generate-upload-thumbnails.mjs
 * (duplicated there since that script runs under plain Node, not Astro's
 * TS pipeline) — keep both in sync if either changes. Returns the original
 * path unchanged for remote covers (e.g. covers.openlibrary.org), which
 * are already small and never get a local thumbnail generated.
 */
export type UploadThumbKind = 'cover' | 'activity';

export function uploadThumb(uploadPath: string, kind: UploadThumbKind): string {
  if (!uploadPath.startsWith('/uploads/')) return uploadPath;
  const base = uploadPath
    .slice(uploadPath.lastIndexOf('/') + 1)
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `/uploads/thumbs/${kind}-${base}.webp`;
}
