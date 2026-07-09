import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { CampusLocation } from '@/lib/campusSearch';

interface Props {
  location: CampusLocation;
  onClose: () => void;
}

/**
 * Panel de info, no un modal: convive con el mapa (no bloquea el resto de
 * la página con un overlay), así que no necesita trap de foco — solo
 * mover el foco a su título al abrirse (útil sobre todo al seleccionar
 * desde la búsqueda, donde el resultado clickeado desaparece del DOM).
 */
export default function CampusLocationPanel({ location, onClose }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [location.id]);

  return (
    <aside
      role="region"
      aria-label={`Información de ${location.name}`}
      className="bg-surface border-border ease-standard absolute inset-x-3 bottom-3 z-10 flex flex-col gap-3 rounded-md border p-4 shadow-lg transition-[opacity,transform] duration-200 sm:inset-x-auto sm:top-3 sm:right-3 sm:bottom-3 sm:w-72"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="bg-secondary/10 text-secondary-strong text-caption inline-flex w-fit rounded-full px-2.5 py-0.5 font-semibold">
            {location.category}
          </span>
          <h2 ref={headingRef} tabIndex={-1} className="text-h4 text-text font-bold outline-none">
            {location.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-text-secondary ease-standard hover:bg-surface-alt inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {location.description && (
        <p className="text-body-sm text-text-secondary">{location.description}</p>
      )}

      {location.instructions && (
        <div className="border-border flex flex-col gap-1 border-t pt-3">
          <span className="text-caption text-text-secondary font-semibold uppercase">
            Cómo llegar
          </span>
          <p className="text-body-sm text-text">{location.instructions}</p>
        </div>
      )}
    </aside>
  );
}
