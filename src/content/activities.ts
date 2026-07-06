/**
 * Mock activities data. Plain module, same approach as
 * src/content/books.ts / careers.ts — no Content Collection, no backend.
 * Shape follows the Activity model in docs/CONTENT_SCHEMA.md. `status` is
 * stored directly instead of derived from dates, to keep pages free of
 * date-comparison logic; it isn't shown as a public-facing badge, only used
 * to disable "Inscribirse" once an activity is `finalizada`.
 *
 * `date`/`time`/`location` are separate fields (not one combined string) so
 * card UIs can lay them out as distinct pieces of info. `category` still
 * exists in the schema (an activity's "tipo") but isn't rendered publicly
 * anymore — it isn't part of the simplified card/detail field set.
 *
 * `slug` is what src/pages/actividades/[slug].astro uses for the detail
 * route. `registrationUrl`, `location` and `description` are optional: not
 * every activity has an open registration link or a long-form description
 * (falls back to `summary` when omitted) — no field should be invented
 * just to fill a template.
 */

export type ActivityStatus = 'proxima' | 'activa' | 'finalizada';
export type ActivityCategory = 'taller' | 'curso' | 'encuentro' | 'capacitacion';

export interface Activity {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  date: string;
  time: string;
  location?: string;
  category: ActivityCategory;
  status: ActivityStatus;
  registrationUrl?: string;
  featured: boolean;
  published: boolean;
}

export const statusLabels: Record<ActivityStatus, string> = {
  proxima: 'Próxima',
  activa: 'Activa',
  finalizada: 'Finalizada',
};

export const categoryLabels: Record<ActivityCategory, string> = {
  taller: 'Taller',
  curso: 'Curso',
  encuentro: 'Encuentro',
  capacitacion: 'Capacitación',
};

export const activities: Activity[] = [
  {
    id: 'activity-taller-suturas',
    slug: 'taller-de-suturas',
    title: 'Taller de Suturas',
    summary: 'Práctica guiada de técnicas básicas de sutura para primer y segundo año.',
    description:
      'Práctica guiada de técnicas básicas de sutura para primer y segundo año. Trabajamos sobre modelos de práctica con instrumental real, en grupos reducidos y con acompañamiento de estudiantes avanzados de ATP.',
    date: '15 de agosto',
    time: '18:00 hs',
    location: 'Aula 3',
    category: 'taller',
    status: 'activa',
    registrationUrl: 'https://forms.gle/ejemplo-taller-suturas',
    featured: true,
    published: true,
  },
  {
    id: 'activity-curso-rcp',
    slug: 'curso-de-rcp',
    title: 'Curso de RCP',
    summary:
      'Certificación en reanimación cardiopulmonar básica, dictado por docentes de la Facultad.',
    description:
      'Certificación en reanimación cardiopulmonar básica, dictado por docentes de la Facultad. Incluye práctica en maniquíes y entrega de certificado de asistencia al finalizar.',
    date: '22 de agosto',
    time: '17:00 hs',
    location: 'Anfiteatro Central',
    category: 'curso',
    status: 'activa',
    registrationUrl: 'https://forms.gle/ejemplo-curso-rcp',
    featured: true,
    published: true,
  },
  {
    id: 'activity-simulacro-ecoe',
    slug: 'simulacro-de-ecoe',
    title: 'Simulacro de ECOE',
    summary: 'Instancia de práctica con estaciones simuladas para rendir el examen ECOE.',
    description:
      'Instancia de práctica con estaciones simuladas para rendir el examen ECOE, pensada para estudiantes que están por rendir la evaluación en los próximos meses.',
    date: '29 de agosto',
    time: '09:00 hs',
    location: 'Aula Magna',
    category: 'capacitacion',
    status: 'proxima',
    registrationUrl: 'https://forms.gle/ejemplo-simulacro-ecoe',
    featured: false,
    published: true,
  },
  {
    id: 'activity-jornada-bienvenida',
    slug: 'jornada-de-bienvenida',
    title: 'Jornada de Bienvenida',
    summary: 'Encuentro para estudiantes ingresantes: conocé ATP y sus propuestas.',
    description:
      'Encuentro para estudiantes ingresantes: conocé ATP, a quienes formamos parte de la agrupación y todas las propuestas que tenemos para acompañarte en el primer año.',
    date: '5 de septiembre',
    time: '10:00 hs',
    location: 'Anfiteatro Central',
    category: 'encuentro',
    status: 'proxima',
    registrationUrl: 'https://forms.gle/ejemplo-jornada-bienvenida',
    featured: false,
    published: true,
  },
  {
    id: 'activity-taller-historia-clinica',
    slug: 'taller-de-historia-clinica',
    title: 'Taller de Historia Clínica',
    summary:
      'Práctica de confección de historia clínica orientada a estudiantes de clínica médica.',
    description:
      'Práctica de confección de historia clínica orientada a estudiantes de clínica médica. Esta edición ya finalizó.',
    date: '10 de julio',
    time: '18:00 hs',
    location: 'Aula 5',
    category: 'taller',
    status: 'finalizada',
    featured: false,
    published: true,
  },
  {
    id: 'activity-encuentro-ingresantes',
    slug: 'encuentro-de-ingresantes',
    title: 'Encuentro de Ingresantes',
    summary: 'Charla informativa sobre el primer año de la carrera y cómo sumarte a ATP.',
    description:
      'Charla informativa sobre el primer año de la carrera y cómo sumarte a ATP. Esta edición ya finalizó.',
    date: '3 de julio',
    time: '16:00 hs',
    location: 'Aula Magna',
    category: 'encuentro',
    status: 'finalizada',
    featured: false,
    published: true,
  },
];
