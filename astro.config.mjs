// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
// `site` and `base` are intentionally omitted until the final domain/repo is known.
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});
