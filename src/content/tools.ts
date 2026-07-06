/**
 * Mock tools data. Same approach as books.ts/activities.ts/careers.ts — a
 * plain module, no Content Collection, no backend. Shape follows the Tool
 * model in docs/CONTENT_SCHEMA.md, limited to the fields the Herramientas
 * page renders. `icon` is a string key (not a component reference), same
 * reasoning as careers.ts: keeps this module free of Astro component
 * imports.
 *
 * `url` is optional — omitted when there's no real destination yet, same
 * rule as careers.ts's tools: the UI must not render a fake "#" link.
 */

export type ToolIconKey = 'book-open' | 'microscope' | 'calculator' | 'activity' | 'link';

export interface Tool {
  id: string;
  slug: string;
  name: string;
  description: string;
  url?: string;
  icon: ToolIconKey;
  published: boolean;
}

export const tools: Tool[] = [
  {
    id: 'tool-atlas-anatomia',
    slug: 'atlas-de-anatomia',
    name: 'Atlas de Anatomía',
    description: 'Recurso interactivo para repasar estructuras del cuerpo humano.',
    icon: 'book-open',
    published: true,
  },
  {
    id: 'tool-microscopio-virtual',
    slug: 'microscopio-virtual',
    name: 'Microscopio Virtual',
    description: 'Explorá preparados histológicos sin necesidad de laboratorio.',
    icon: 'microscope',
    published: true,
  },
  {
    id: 'tool-calculadora-imc',
    slug: 'calculadora-imc',
    name: 'Calculadora de IMC',
    description: 'Calculá el índice de masa corporal a partir de peso y altura.',
    icon: 'calculator',
    published: true,
  },
  {
    id: 'tool-simulador-ecg',
    slug: 'simulador-ecg',
    name: 'Simulador de ECG',
    description: 'Practicá la lectura de electrocardiogramas con casos guiados.',
    icon: 'activity',
    published: true,
  },
  {
    id: 'tool-transparencia-virtual',
    slug: 'transparencia-virtual',
    name: 'Transparente Virtual',
    description: 'Consultá el estado de tus materias y correlatividades.',
    icon: 'link',
    published: true,
  },
  {
    id: 'tool-siu-guarani',
    slug: 'siu-guarani',
    name: 'SIU Guaraní',
    description: 'Inscripción a materias, finales y trámites académicos.',
    icon: 'link',
    published: true,
  },
];
