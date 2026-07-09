import type { CampusLocation } from '@/lib/campusSearch';

interface Props {
  location: CampusLocation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * El botón entero es el hit target de 28×28px (WCAG 2.5.8); el punto
 * visible es más chico para no tapar el plano — mismo patrón que los dots
 * del Carousel (src/components/Carousel.astro).
 */
export default function CampusMarker({ location, isSelected, onSelect }: Props) {
  return (
    <button
      id={`campus-marker-${location.id}`}
      type="button"
      onClick={() => onSelect(location.id)}
      aria-label={`${location.name} — ${location.category}`}
      aria-pressed={isSelected}
      className="group absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{ left: `${location.x}%`, top: `${location.y}%` }}
    >
      <span
        className={
          'ease-standard block rounded-full border-2 border-white shadow-md transition-transform duration-150 ' +
          (isSelected
            ? 'bg-primary-fill size-5 scale-110'
            : 'bg-secondary-strong size-3.5 group-hover:scale-125')
        }
        aria-hidden="true"
      />
    </button>
  );
}
