/**
 * Career pages data (Fase 4). Same approach as books.ts/activities.ts/
 * news.ts — plain module, no Content Collection, no backend. Shape follows
 * the Career model in docs/CONTENT_SCHEMA.md, limited to the fields the
 * dynamic route at src/pages/carreras/[career].astro actually renders.
 *
 * Lives here (not inline in the page) because Astro hoists a page's
 * `getStaticPaths` to module scope separately from the rest of the
 * frontmatter — a top-level `const` declared in the page itself ends up
 * scoped inside the component body instead, invisible to getStaticPaths.
 * An imported binding doesn't have that problem.
 *
 * `tools[].icon` is a string key, not a component reference — the page
 * maps it to an actual icon component at render time, keeping this module
 * free of Astro component imports.
 */

export type ToolIconKey = 'book-open' | 'microscope' | 'calendar-check';

export interface CareerTool {
  name: string;
  description: string;
  /** Omit when there's no real destination yet — the UI must not render a fake link. */
  href?: string;
  icon: ToolIconKey;
}

export interface CareerResource {
  label: string;
  href: string;
  external: boolean;
}

export interface Career {
  slug: string;
  name: string;
  description: string;
  tools: CareerTool[];
  resources: CareerResource[];
}

export const careers: Career[] = [
  {
    slug: 'medicina',
    name: 'Medicina',
    description:
      'Medicina es la carrera con mayor cantidad de recursos disponibles en ATP: calendario académico, atlas de anatomía, microscopios virtuales y guías de estudio para cada año.',
    tools: [
      {
        name: 'Atlas de Anatomía',
        description: 'Recurso interactivo para repasar estructuras del cuerpo humano.',
        icon: 'book-open',
      },
      {
        name: 'Microscopio Virtual',
        description: 'Explorá preparados histológicos sin necesidad de laboratorio.',
        icon: 'microscope',
      },
      {
        name: 'Calendario Académico',
        description: 'Fechas clave de cursada y mesas de examen.',
        icon: 'calendar-check',
      },
    ],
    resources: [
      { label: 'Materiales de Medicina en la Biblioteca', href: '/biblioteca', external: false },
      {
        label: 'Guías de estudio de ATP',
        href: 'https://drive.google.com/drive/folders/ejemplo-guias-medicina',
        external: true,
      },
    ],
  },
  {
    slug: 'enfermeria',
    name: 'Enfermería',
    description:
      'Espacio dedicado a la carrera de Enfermería, con material de estudio y acompañamiento de ATP durante toda la cursada.',
    tools: [],
    resources: [
      { label: 'Materiales de Enfermería en la Biblioteca', href: '/biblioteca', external: false },
    ],
  },
  {
    slug: 'fonoaudiologia',
    name: 'Fonoaudiología',
    description:
      'Espacio dedicado a la carrera de Fonoaudiología, con material de estudio y acompañamiento de ATP durante toda la cursada.',
    tools: [],
    resources: [
      {
        label: 'Materiales de Fonoaudiología en la Biblioteca',
        href: '/biblioteca',
        external: false,
      },
    ],
  },
  {
    slug: 'terapia-ocupacional',
    name: 'Terapia Ocupacional',
    description:
      'Espacio dedicado a la carrera de Terapia Ocupacional, con material de estudio y acompañamiento de ATP durante toda la cursada.',
    tools: [],
    resources: [
      {
        label: 'Materiales de Terapia Ocupacional en la Biblioteca',
        href: '/biblioteca',
        external: false,
      },
    ],
  },
];
