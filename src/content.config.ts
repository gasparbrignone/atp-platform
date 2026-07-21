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

/**
 * An optional http(s) URL field. Despite `omit_empty_optional_fields: true`
 * in the CMS config, Sveltia can still write `""` for a field the editor
 * touched and then cleared instead of omitting the key — plain
 * `z.httpUrl().nullish()` rejects that empty string as an invalid URL and
 * breaks the *entire* build (seen in production: `downloadUrl: ""` on a
 * book took the whole site down). This treats blank/whitespace-only
 * strings the same as "no value" before the URL check ever runs.
 */
const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.httpUrl().nullish(),
);

/**
 * Same bug, different field type: an optional `widget: select` (ej.
 * "Día de la semana") can also come back as `""` instead of an omitted
 * key when Sveltia touches-then-clears it — `z.enum(...).nullish()` alone
 * rejects that empty string as an invalid option and breaks the *entire*
 * build (seen in production: `weekday: ""` on a test activity took the
 * whole site down, same failure mode `optionalUrl` above already covers
 * for URL fields). Reusable since this isn't specific to weekdays.
 */
function optionalEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.enum(values).nullish(),
  );
}

const weekdayValues = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

// Una clase suelta dentro de una actividad compuesta (ej. "Semana de
// repasos CyD" con una clase distinta por día). Sin `recurring`: cada
// sesión es un encuentro puntual dentro de la serie, no algo que se repita
// semana a semana por sí solo — eso lo decide la actividad contenedora.
const activitySession = z.object({
  title: z.string(),
  // Fecha puntual (ej. "2026-08-03") para una clase suelta con día calendario
  // real, no solo un día de la semana — necesario cuando las clases de una
  // actividad compuesta caen en fechas concretas (no todas la misma semana).
  // Coexiste con `weekday`: cargar una no exige borrar la otra, pero
  // `getActivityScheduleLabel` (src/lib/activitySchedule.ts) prioriza
  // `weekday` si ambas están presentes.
  date: z.string().nullish(),
  weekday: optionalEnum(weekdayValues),
  time: z.string().nullish(),
  endTime: z.string().nullish(),
  location: z.string().nullish(),
});

// Agrupa los campos de horario en un solo objeto (en vez de sueltos al nivel
// raíz de la actividad) para que el CMS los muestre como un sub-formulario
// colapsable ("Agenda") — la actividad tiene muchos campos y sin esta
// agrupación el formulario del CMS quedaba como una lista plana de 17+
// campos sin ninguna organización visual (Sveltia no soporta separadores o
// secciones de otra forma, solo agrupando con `widget: object`).
const activitySchedule = z.object({
  // Actividad que se repite todas las semanas el mismo día/horario (ej.
  // "grupo de estudio, todos los miércoles"), en vez de un evento puntual
  // con `date` fija que habría que reeditar cada semana para que no quede
  // vieja. `weekday` solo se usa cuando `recurring` es true.
  recurring: z.boolean().nullish(),
  weekday: optionalEnum(weekdayValues),
  // `date`/`time` no son requeridos: una actividad `recurring` no tiene una
  // fecha puntual — se describe con `weekday` en su lugar (ver
  // src/lib/activitySchedule.ts). Tampoco lo son en una actividad compuesta
  // (con `sessions`), que no usa este objeto para nada.
  date: z.string().nullish(),
  time: z.string().nullish(),
  endTime: z.string().nullish(),
  location: z.string().nullish(),
});

// Mismo motivo que `activitySchedule`: agrupa la decisión de cómo
// inscribirse en un sub-formulario propio ("Inscripción") en vez de dos
// campos sueltos más en la lista raíz.
const activityRegistration = z.object({
  // Cuando está en true, la página de detalle muestra el formulario propio
  // (src/components/ActivityRegistrationForm.astro, escribe a un Google
  // Sheet vía Apps Script) en vez del botón que linkea a `registrationUrl`
  // — nunca ambos a la vez (ver src/pages/actividades/[slug].astro).
  useRegistrationForm: z.boolean().nullish(),
  registrationUrl: optionalUrl,
});

const activities = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/activities' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    // `.nullish()`, no `.optional()`: el CMS (Sveltia) guarda un campo
    // opcional vacío como `null` explícito, no como clave ausente — el
    // schema tiene que aceptar ambas formas de "no hay valor".
    description: z.string().nullish(),
    // Ruta a `public/uploads/...` (media library del CMS), no el helper
    // `image()` de Astro — mismo motivo que `books.cover`: ese helper exige
    // que el archivo exista en build time, y esto lo carga cada persona
    // desde el CMS después. Decorativa en las cards (alt=""), el título ya
    // dice de qué se trata.
    image: z.string().nullish(),
    schedule: activitySchedule,
    status: z.enum(['proxima', 'activa', 'finalizada']),
    // Actividad compuesta (ej. "Semana de repasos CyD"): en vez de una
    // fecha/horario único, agrupa varias clases sueltas, cada una con su
    // propio título/día/horario/lugar. Cuando está presente, la página de
    // detalle lista cada sesión en vez de mostrar una sola línea de
    // horario (ver src/pages/actividades/[slug].astro).
    sessions: z.array(activitySession).nullish(),
    registration: activityRegistration,
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
    // Slug de una entrada de la colección `subjects` (no el nombre libre de
    // antes) — se resuelve contra esa colección al armar la página, igual
    // que `career` se resuelve contra `careerLabels`. Permite crear materias
    // nuevas desde el CMS sin tocar código (ver `subjects` más abajo).
    subject: z.string(),
    career: z.array(z.enum(['medicina', 'enfermeria', 'fonoaudiologia', 'terapia-ocupacional'])),
    // Slug de una entrada de `resourceTypes`, mismo motivo que `subject`:
    // antes era un `z.enum` fijo (libro/resumen/guia), ahora es
    // CMS-extensible (ej. "cuaderno del alumno") sin deploy de código.
    resourceType: z.string(),
    // Link para el botón "Descargar". Puede faltar mientras `driveUrl` está
    // siendo migrado automáticamente a un asset de GitHub Releases (ver
    // .github/workflows/migrate-drive-books.yml) — por eso `.nullish()` y no
    // requerido: un libro recién cargado no debe romper el build entero
    // mientras la migración corre.
    downloadUrl: optionalUrl,
    // Link de "Compartir" de Google Drive tal cual lo pega la persona que
    // carga el libro. El workflow de migración lo lee, descarga el archivo,
    // lo sube como asset de GitHub Releases y completa `downloadUrl` solo —
    // nunca se usa directamente como link de descarga (ver STACK_DECISIONS.md
    // → Biblioteca).
    driveUrl: optionalUrl,
    published: z.boolean(),
    // Todavía sin consumidor en ninguna página — solo preparar el modelo y
    // el CMS para cuando haya portadas reales. Path plano (no el helper
    // `image()` de Astro) porque ese helper exige que el archivo
    // referenciado exista en build time, y hoy no hay ninguna imagen real.
    cover: z.string().nullish(),
    order: z.number().nullish(),
  }),
});

// Materias (ej. "Fisiología") y tipos de recurso (ej. "Cuaderno del
// alumno") como colecciones editables desde el CMS en vez de listas fijas
// en código — así ATP puede crear una categoría nueva (ej. al cargar el
// primer libro de Inmunología) sin pedir un cambio de código.
const subjects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/subjects' }),
  schema: z.object({
    name: z.string(),
    order: z.number().nullish(),
  }),
});

const resourceTypes = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/resourceTypes' }),
  schema: z.object({
    name: z.string(),
    order: z.number().nullish(),
  }),
});

const careers = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/careers' }),
  schema: z.object({
    name: z.string(),
    // Nullish, no requerido: Enfermería/Fonoaudiología/Terapia Ocupacional
    // no tienen todavía una descripción propia real (tenían un texto
    // genérico calcado entre las tres) — mejor sin nada que repetir el
    // mismo párrafo en las tres carreras.
    description: z.string().nullish(),
    // Cada carrera tiene su propia cuenta de Instagram salvo Medicina, que
    // usa la general @atp.fcm (ver SocialLinks.astro) — por eso es nullish
    // en vez de requerido.
    instagram: optionalUrl,
    tools: z.array(
      z.object({
        name: z.string(),
        // Markdown en línea (negrita/cursiva/links), no texto plano — mismo
        // renderer que `tools.description` (la colección Herramientas
        // suelta, ver más abajo), vía src/lib/markdown.ts.
        description: z.string(),
        // Ruta a `public/uploads/...`, mismo criterio que `activities.image`
        // — opcional: una herramienta puede seguir siendo solo ícono +
        // texto si nadie carga una foto.
        image: z.string().nullish(),
        href: optionalUrl,
        icon: z.enum(['book-open', 'microscope', 'calendar-check']),
        // Reemplaza el ícono Lucide de arriba por una imagen propia (PNG,
        // logo de la app/sitio, etc.) cuando está cargada — `icon` sigue
        // siendo obligatorio como fallback, así el círculo nunca queda
        // vacío si a alguien no le interesa subir uno personalizado.
        customIcon: z.string().nullish(),
      }),
    ),
    resources: z.array(
      z.object({
        label: z.string(),
        // Opcional: un recurso puede seguir siendo solo un link con
        // etiqueta, como hasta ahora. Markdown en línea igual que
        // `tools.description`.
        description: z.string().nullish(),
        image: z.string().nullish(),
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
    url: optionalUrl,
    icon: z.enum(['book-open', 'microscope', 'calculator', 'activity', 'link']),
    // Mismo mecanismo que careers.tools.customIcon: imagen propia en vez
    // del ícono Lucide de arriba, cuando está cargada.
    customIcon: z.string().nullish(),
    published: z.boolean(),
    order: z.number().nullish(),
    // Everything below is optional so an entry can stay a simple card (name
    // + description + link) or grow into its own detail page
    // (/herramientas/{slug}) with a longer body, photos and extra links —
    // whichever the person loading content actually has to give it.
    // Full Markdown (headings, lists, links, `---`, and `[!NOTE]`-style
    // callout blockquotes) rendered via src/lib/markdown.ts — see the
    // `description` comment above re: not reopening the CMS file-format
    // decision.
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

export const collections = { activities, books, careers, tools, subjects, resourceTypes };
