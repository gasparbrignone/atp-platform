/**
 * Condiciones de la venta de libritos (precio, tope, retiro), separadas del
 * catálogo (bookletSale.ts) para que el script del navegador de
 * BookletSaleSection.astro pueda importarlas sin arrastrar las imágenes al
 * bundle. El Apps Script tiene su propia copia de precio y tope
 * (BOOKLET_UNIT_PRICE, BOOKLET_MAX_PER_ITEM) y es la que vale para cobrar:
 * si cambian, actualizar los dos lados.
 */
export const BOOKLET_UNIT_PRICE = 4000;

/** Tope por librito en un mismo pedido. */
export const BOOKLET_MAX_PER_ITEM = 10;

export const BOOKLET_FORMAT = 'Tamaño A5, full color';

export const BOOKLET_PICKUP = 'Podés buscarlo por nuestra mesita cualquier día de 10 a 14hs.';

export function formatPesos(amount: number): string {
  return `$${amount.toLocaleString('es-AR')}`;
}
