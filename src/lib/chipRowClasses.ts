/**
 * Fila de chips/pills compartida (ChipRadioGroup, QuickSearchPills).
 * `scroll`: una sola fila que se desliza con el dedo — en el celular no
 * ocupa media pantalla — y llega hasta el borde (margen negativo = el
 * padding de Container). Desde `lg` vuelve a varias filas: con mouse,
 * deslizar de costado es incómodo.
 */
export type ChipRowLayout = 'wrap' | 'scroll';

export function getChipRowClasses(layout: ChipRowLayout): string {
  return layout === 'scroll'
    ? 'flex gap-2 -mx-4 flex-nowrap overflow-x-auto px-4 [scrollbar-width:none] md:-mx-6 md:px-6 lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden'
    : 'flex flex-wrap gap-2';
}
