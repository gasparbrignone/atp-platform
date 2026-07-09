/**
 * Label maps de UI para los enums de src/content.config.ts. Viven separados
 * del schema de contenido porque son vocabulario de presentación (español),
 * no forma de datos.
 *
 * Los union types de acá duplican los `z.enum([...])` del content config en
 * vez de derivarse con `z.infer` porque eso crearía un acoplamiento inverso
 * (esta lib de UI dependiendo del schema de contenido) por 4 uniones cortas
 * y estables — la duplicación controlada es preferible.
 */

export type ActivityStatus = 'proxima' | 'activa' | 'finalizada';
export type Weekday =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo';
export type CareerSlug = 'medicina' | 'enfermeria' | 'fonoaudiologia' | 'terapia-ocupacional';
export type ToolIconKey = 'book-open' | 'microscope' | 'calculator' | 'activity' | 'link';
export type CareerToolIconKey = 'book-open' | 'microscope' | 'calendar-check';

export const statusLabels: Record<ActivityStatus, string> = {
  proxima: 'Próxima',
  activa: 'Activa',
  finalizada: 'Finalizada',
};

export const weekdayLabels: Record<Weekday, string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  domingo: 'domingo',
};

// No hay `resourceTypeLabels` acá a propósito: los tipos de recurso de la
// Biblioteca (libro/resumen/guía/...) ya no son un enum fijo, son la
// colección editable `resourceTypes` — se resuelven contra ella en
// src/pages/biblioteca.astro, igual que `subjects`.

export const careerLabels: Record<CareerSlug, string> = {
  medicina: 'Medicina',
  enfermeria: 'Enfermería',
  fonoaudiologia: 'Fonoaudiología',
  'terapia-ocupacional': 'Terapia Ocupacional',
};
