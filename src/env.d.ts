/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * Server-only (sin prefijo `PUBLIC_`, nunca llega al bundle del cliente).
   * Usada en build time por src/lib/youtube.ts — ver docs/YOUTUBE_SETUP.md.
   */
  readonly YOUTUBE_API_KEY?: string;
  /**
   * Server-only, igual que la de arriba. Token de solo lectura de
   * GoatCounter, usado en build time por src/lib/goatcounter.ts para las
   * "búsquedas frecuentes" de la Biblioteca.
   */
  readonly GOATCOUNTER_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
