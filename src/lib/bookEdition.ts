/**
 * Etiqueta corta de la edición de un libro ("12.ª ed."), compartida entre la
 * tarjeta de la Biblioteca y el buscador global para que dos ediciones del
 * mismo libro se distingan igual en ambos lados. Ordinal con punto + "ª"
 * según la RAE (no "12va" ni "12°").
 */
export function formatEdition(edition: number | null | undefined): string | null {
  return edition ? `${edition}.ª ed.` : null;
}
