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
    description: z.string().optional(),
    date: z.string(),
    time: z.string(),
    location: z.string().optional(),
    status: z.enum(['proxima', 'activa', 'finalizada']),
    registrationUrl: z.httpUrl().optional(),
    featured: z.boolean(),
    published: z.boolean(),
    order: z.number().optional(),
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
    // el CMS (Decap) para cuando haya portadas reales. Path plano (no el
    // helper `image()` de Astro) porque ese helper exige que el archivo
    // referenciado exista en build time, y hoy no hay ninguna imagen real.
    cover: z.string().optional(),
    order: z.number().optional(),
  }),
});

const careers = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/careers' }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    tools: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        href: z.httpUrl().optional(),
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
    description: z.string(),
    url: z.httpUrl().optional(),
    icon: z.enum(['book-open', 'microscope', 'calculator', 'activity', 'link']),
    published: z.boolean(),
    order: z.number().optional(),
  }),
});

export const collections = { activities, books, careers, tools };
