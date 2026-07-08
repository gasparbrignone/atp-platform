/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * Server-only (sin prefijo `PUBLIC_`, nunca llega al bundle del cliente).
   * Usada en build time por src/lib/youtube.ts — ver docs/YOUTUBE_SETUP.md.
   */
  readonly YOUTUBE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
