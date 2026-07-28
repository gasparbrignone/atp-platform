// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

// https://astro.build/config
// Dominio propio confirmado (atpfcm.com.ar, comprado en nic.ar) — sin `base`:
// al ser un dominio propio en la raíz, no un project site de GitHub Pages,
// ninguno de los links internos absolutos del sitio (p. ej. href="/biblioteca/")
// necesita un prefijo y no se rompen.
//
// El build genera cada ruta como carpeta + index.html (ej.
// `biblioteca/index.html`), y GitHub Pages devuelve 301 de `/biblioteca` a
// `/biblioteca/` — visto en producción como "página con redirección" en
// Search Console para varias URLs. Por eso todo link interno del sitio
// (Navbar, Footer, canonicalPath, "volver a...", etc.) termina con `/`: sin
// eso, cada click y cada URL del sitemap le suma un salto de redirect de
// más a quien visita y a Google.
export default defineConfig({
  site: 'https://atpfcm.com.ar',
  integrations: [sitemap(), react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
