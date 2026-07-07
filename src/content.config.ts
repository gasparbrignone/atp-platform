/**
 * Content Layer API (Astro 5+). Cada colección se carga desde una carpeta de
 * JSON planos en src/content/<colección>/ — un archivo por entrada, nombre de
 * archivo = slug. `entry.id` (derivado del filename por el loader `glob`)
 * reemplaza a los antiguos campos `id`/`slug` de los módulos .ts que esto
 * reemplaza; no se migran, serían redundantes con el nombre del archivo.
 *
 * Los label maps de UI (statusLabels, careerLabels, etc.) viven en
 * src/lib/labels.ts, no acá — este archivo es solo forma de los datos.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const activities = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/activities' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    // `.nullish()`, no `.optional()`: el CMS (Sveltia) guarda un campo
    // opcional vacío como `null` explícito, no como clave ausente — el
    // schema tiene que aceptar ambas formas de "no hay valor".
    description: z.string().nullish(),
    date: z.string(),
    time: z.string(),
    location: z.string().nullish(),
    status: z.enum(['proxima', 'activa', 'finalizada']),
    registrationUrl: z.httpUrl().nullish(),
    featured: z.boolean(),
    published: z.boolean(),
    order: z.number().nullish(),
  }),
});

const books = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/books' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    subject: z.string(),
    career: z.array(z.enum(['medicina', 'enfermeria', 'fonoaudiologia', 'terapia-ocupacional'])),
    resourceType: z.enum(['libro', 'resumen', 'guia']),
    downloadUrl: z.httpUrl(),
    description: z.string(),
    published: z.boolean(),
    // Todavía sin consumidor en ninguna página — solo preparar el modelo y
    // el CMS para cuando haya portadas reales. Path plano (no el helper
    // `image()` de Astro) porque ese helper exige que el archivo
    // referenciado exista en build time, y hoy no hay ninguna imagen real.
    cover: z.string().nullish(),
    order: z.number().nullish(),
  }),
});

const careers = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/careers' }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    // Cada carrera tiene su propia cuenta de Instagram salvo Medicina, que
    // usa la general @atp.fcm (ver SocialLinks.astro) — por eso es nullish
    // en vez de requerido.
    instagram: z.httpUrl().nullish(),
    tools: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        href: z.httpUrl().nullish(),
        icon: z.enum(['book-open', 'microscope', 'calendar-check']),
      }),
    ),
    resources: z.array(
      z.object({
        label: z.string(),
        // No se restringe a http(s) como el resto de las URLs: a diferencia
        // de tools.href, este campo también aporta links internos del sitio
        // (p. ej. "/biblioteca", ver el flag `external`) y los datos
        // existentes ya usan esa forma — restringirlo rompería contenido real.
        href: z.string(),
        external: z.boolean(),
      }),
    ),
  }),
});

const tools = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/tools' }),
  schema: z.object({
    name: z.string(),
    // Inline Markdown (bold/italics/links) — rendered via
    // src/lib/markdown.ts, not plain text like the other collections'
    // `description`. Doesn't reopen "JSON plano, no Markdown" below: that
    // decision is about the entry file format, this is just syntax inside
    // one string field of it.
    description: z.string(),
    url: z.httpUrl().nullish(),
    icon: z.enum(['book-open', 'microscope', 'calculator', 'activity', 'link']),
    published: z.boolean(),
    order: z.number().nullish(),
    // Everything below is optional so an entry can stay a simple card (name
    // + description + link) or grow into its own detail page
    // (/herramientas/{slug}) with a longer body, photos and extra links —
    // whichever the person loading content actually has to give it.
    // Plain text, not Markdown (see docs/STACK_DECISIONS.md → CMS: "JSON
    // plano, no Markdown"): rendered with `whitespace-pre-line` so blank
    // lines from the CMS's multiline text widget still read as paragraphs.
    content: z.string().nullish(),
    // Plain upload paths (e.g. `/uploads/xyz.jpg`), same treatment as
    // `books.cover` — not Astro's `image()` helper, which requires the file
    // to exist at build time and would break for anything uploaded later
    // through the CMS media library. `alt` is required (not nullish): every
    // content image needs real alt text per CLAUDE.md, so the CMS field is
    // marked required rather than letting it silently fall back to "".
    images: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string(),
        }),
      )
      .nullish(),
    resources: z
      .array(
        z.object({
          label: z.string(),
          // Not restricted to http(s), same reasoning as careers.resources:
          // this also carries internal site links (e.g. "/biblioteca").
          href: z.string(),
          external: z.boolean(),
        }),
      )
      .nullish(),
  }),
});

export const collections = { activities, books, careers, tools };
