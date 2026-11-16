/**
 * Venta de libritos ATP (2026-11-16) — catálogo que muestra
 * src/components/BookletSaleSection.astro (precio, tope y retiro viven en
 * bookletSaleTerms.ts). El cobro es por Mercado Pago (Checkout Pro), armado
 * y verificado del lado del Apps Script (docs/GOOGLE_SHEETS_FORM_SETUP.md,
 * "VENTA DE LIBRITOS"): las claves y títulos de acá están repetidos allá
 * (BOOKLET_PRODUCTS) porque el sitio y el script son dos runtimes sin forma
 * de compartir código. Si se suma o cambia un librito, actualizar los dos
 * lados.
 */
import type { ImageMetadata } from 'astro';
import ecgNormalImage from '@/assets/libritos/ecg-normal.png';
import ecgPatologicoImage from '@/assets/libritos/ecg-patologico.png';
import esquemasImage from '@/assets/libritos/esquemas-medicos.png';

export interface BookletProduct {
  /** Viaja al Apps Script como `${key}Qty` — tiene que coincidir con BOOKLET_PRODUCTS allá. */
  key: string;
  title: string;
  description: string;
  image: ImageMetadata;
}

export const bookletProducts: BookletProduct[] = [
  {
    key: 'ecgNormal',
    title: 'ECG Normal',
    description:
      'Todo lo que necesitás saber para entender un ECG normal, desde las derivaciones hasta sus ondas y criterios de normalidad. Si ya pasaste TyTL te sirve para repasar ;)',
    image: ecgNormalImage,
  },
  {
    key: 'ecgPatologico',
    title: 'ECG Patológico',
    description:
      'Alteraciones en el ECG: trastornos de conducción, patología coronaria, hipertrofias y arritmias.',
    image: ecgPatologicoImage,
  },
  {
    key: 'esquemas',
    title: '100 Esquemas Médicos',
    description:
      'Ilustraciones, conceptos y recursos visuales para entender, relacionar y repasar. Porque a veces un buen esquema vale más que mil palabras ;)',
    image: esquemasImage,
  },
];
