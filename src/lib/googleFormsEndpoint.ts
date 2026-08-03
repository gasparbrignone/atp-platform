/**
 * URL de la implementación ("Aplicación web") del Apps Script compartido que
 * recibe todos los formularios propios del sitio (inscripción a actividades,
 * reserva de la agenda, etc.) y escribe cada uno en su propia hoja de un
 * Google Sheet — ver docs/GOOGLE_SHEETS_FORM_SETUP.md para los pasos de
 * deploy. Un solo módulo en vez de repetir el literal en cada formulario: si
 * el script se vuelve a implementar como "Nueva implementación", esta es la
 * única línea que hay que actualizar.
 */
export const GOOGLE_FORMS_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzIYU4H3B94IoTyH40O4EXljqPVTNGd0Ult_yi8VzS3hhAOjScEdsCQlNZarE5Ixe6f/exec';
