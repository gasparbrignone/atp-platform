/**
 * Mock library data (Fase 4). Plain module, not an Astro Content Collection —
 * no schema/config machinery yet, per current scope (static/local data only).
 * Shape follows the Book model in docs/CONTENT_SCHEMA.md, limited to the
 * fields the Biblioteca page actually renders.
 */

export type ResourceType = 'libro' | 'resumen' | 'guia';
export type CareerSlug = 'medicina' | 'enfermeria' | 'fonoaudiologia' | 'terapia-ocupacional';

export interface Book {
  id: string;
  slug: string;
  title: string;
  author: string;
  subject: string;
  career: CareerSlug[];
  resourceType: ResourceType;
  downloadUrl: string;
  description: string;
  published: boolean;
}

export const resourceTypeLabels: Record<ResourceType, string> = {
  libro: 'Libro',
  resumen: 'Resumen',
  guia: 'Guía',
};

export const careerLabels: Record<CareerSlug, string> = {
  medicina: 'Medicina',
  enfermeria: 'Enfermería',
  fonoaudiologia: 'Fonoaudiología',
  'terapia-ocupacional': 'Terapia Ocupacional',
};

export const books: Book[] = [
  {
    id: 'book-anatomia-netter',
    slug: 'anatomia-humana-netter',
    title: 'Anatomía Humana',
    author: 'Frank H. Netter',
    subject: 'Anatomía',
    career: ['medicina'],
    resourceType: 'libro',
    downloadUrl: 'https://drive.google.com/drive/folders/ejemplo-anatomia-netter',
    description:
      'Atlas de referencia con ilustraciones detalladas de todos los sistemas del cuerpo.',
    published: true,
  },
  {
    id: 'book-fisiologia-guyton',
    slug: 'fisiologia-medica-guyton',
    title: 'Fisiología Médica',
    author: 'Guyton & Hall',
    subject: 'Fisiología',
    career: ['medicina'],
    resourceType: 'libro',
    downloadUrl: 'https://drive.google.com/drive/folders/ejemplo-fisiologia-guyton',
    description: 'Texto clásico de fisiología humana con enfoque clínico integrado.',
    published: true,
  },
  {
    id: 'book-resumen-farmacologia',
    slug: 'resumen-farmacologia-atp',
    title: 'Resumen de Farmacología General',
    author: 'ATP',
    subject: 'Farmacología',
    career: ['medicina'],
    resourceType: 'resumen',
    downloadUrl: 'https://drive.google.com/drive/folders/ejemplo-resumen-farmacologia',
    description: 'Resumen elaborado por estudiantes con los ejes principales de la materia.',
    published: true,
  },
  {
    id: 'book-guia-semiologia',
    slug: 'guia-semiologia-atp',
    title: 'Guía de Semiología Clínica',
    author: 'ATP',
    subject: 'Semiología',
    career: ['medicina'],
    resourceType: 'guia',
    downloadUrl: 'https://drive.google.com/drive/folders/ejemplo-guia-semiologia',
    description: 'Guía práctica de anamnesis y examen físico por aparatos.',
    published: true,
  },
  {
    id: 'book-histologia-junqueira',
    slug: 'histologia-basica-junqueira',
    title: 'Histología Básica',
    author: 'Junqueira & Carneiro',
    subject: 'Histología',
    career: ['medicina'],
    resourceType: 'libro',
    downloadUrl: 'https://drive.google.com/drive/folders/ejemplo-histologia-junqueira',
    description: 'Introducción a los tejidos y su organización microscópica.',
    published: true,
  },
  {
    id: 'book-fundamentos-enfermeria',
    slug: 'fundamentos-enfermeria-kozier',
    title: 'Fundamentos de Enfermería',
    author: 'Kozier & Erb',
    subject: 'Fundamentos de Enfermería',
    career: ['enfermeria'],
    resourceType: 'libro',
    downloadUrl: 'https://drive.google.com/drive/folders/ejemplo-fundamentos-enfermeria',
    description: 'Conceptos, procesos y técnicas fundamentales del cuidado de enfermería.',
    published: true,
  },
  {
    id: 'book-guia-evaluacion-fonoaudiologica',
    slug: 'guia-evaluacion-fonoaudiologica',
    title: 'Guía de Evaluación Fonoaudiológica',
    author: 'ATP',
    subject: 'Evaluación Fonoaudiológica',
    career: ['fonoaudiologia'],
    resourceType: 'guia',
    downloadUrl: 'https://drive.google.com/drive/folders/ejemplo-guia-fonoaudiologia',
    description: 'Protocolos y pautas orientativas para la evaluación inicial.',
    published: true,
  },
  {
    id: 'book-terapia-ocupacional-willard',
    slug: 'terapia-ocupacional-willard-spackman',
    title: 'Terapia Ocupacional: Fundamentos y Práctica',
    author: 'Willard & Spackman',
    subject: 'Fundamentos de Terapia Ocupacional',
    career: ['terapia-ocupacional'],
    resourceType: 'libro',
    downloadUrl: 'https://drive.google.com/drive/folders/ejemplo-terapia-ocupacional',
    description: 'Marco teórico y práctico central de la disciplina.',
    published: true,
  },
];
