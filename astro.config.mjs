// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
// Dominio propio confirmado (atpfcm.com.ar, comprado en nic.ar) — sin `base`:
// al ser un dominio propio en la raíz, no un project site de GitHub Pages,
// ninguno de los links internos absolutos del sitio (p. ej. href="/biblioteca")
// necesita un prefijo y no se rompen. La configuración de DNS/CNAME para que
// GitHub Pages sirva este dominio queda para la Fase 17 (Despliegue).
export default defineConfig({
  site: 'https://atpfcm.com.ar',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
