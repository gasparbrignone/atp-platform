import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * pdf.js hace el parseo/render pesado en un Web Worker aparte — hay que
 * decirle desde dónde cargarlo. Un solo módulo para esta asignación:
 * tanto CertificateFieldEditor (Fase 3) como CertificateReviewCarousel
 * (Fase 5) usan pdf.js, y `GlobalWorkerOptions.workerSrc` es global a
 * todo el módulo `pdfjs-dist` — asignarlo dos veces no rompe nada, pero
 * mejor un único lugar de verdad.
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { pdfjsLib };
