import { useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import { Plus, Minus, RotateCcw } from 'lucide-react';
import { searchCampusLocations, type CampusLocation } from '@/lib/campusSearch';
import CampusMapSearch from './CampusMapSearch';
import CampusMarker from './CampusMarker';
import CampusLocationPanel from './CampusLocationPanel';

interface Props {
  locations: CampusLocation[];
  mapImage: { src: string; width: number; height: number };
}

// Leído del browser, no de Astro.url: esta página es 100% estática (sin
// SSR), así que `Astro.url.searchParams` en el `.astro` se resuelve una
// sola vez en build time y nunca ve el `?ubicar=1` real de quien visita
// el sitio — tiene que resolverse en el cliente.
function readLocateModeFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('ubicar') === '1';
}

export default function CampusMap({ locations, mapImage }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pickedPoint, setPickedPoint] = useState<{ x: number; y: number } | null>(null);
  const [locateMode] = useState(readLocateModeFromUrl);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  const suggestions = useMemo(() => searchCampusLocations(locations, query), [locations, query]);
  const selectedLocation = locations.find((location) => location.id === selectedId) ?? null;

  function focusLocation(id: string) {
    setSelectedId(id);
    setPickedPoint(null);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    transformRef.current?.zoomToElement(
      `campus-marker-${id}`,
      1.6,
      prefersReducedMotion ? 0 : 400,
      'easeOutQuad',
    );
  }

  function handleCanvasClick(event: MouseEvent<HTMLDivElement>) {
    if (!locateMode) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setPickedPoint({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }

  return (
    <div className="flex flex-col gap-4">
      <CampusMapSearch
        query={query}
        onQueryChange={setQuery}
        suggestions={suggestions}
        onSelect={focusLocation}
      />

      {locateMode && (
        <div className="border-warning bg-warning/10 text-warning text-caption rounded-md border p-3 font-semibold">
          Modo "Ubicar" activo: hacé click en el plano para ver las coordenadas x/y de ese punto y
          copiarlas al CMS.
          {pickedPoint && (
            <span className="text-body-sm mt-1 block">
              x: {pickedPoint.x} · y: {pickedPoint.y}
            </span>
          )}
        </div>
      )}

      <div className="border-border bg-surface-alt relative overflow-hidden rounded-md border">
        <TransformWrapper
          ref={transformRef}
          initialScale={1}
          minScale={0.8}
          maxScale={4}
          centerOnInit
          limitToBounds
          doubleClick={{ mode: 'zoomIn' }}
        >
          <TransformComponent
            wrapperClass="!w-full !h-[60vh] sm:!h-[70vh]"
            contentClass="!w-full !h-full"
          >
            <div
              className="relative"
              style={{ width: mapImage.width, height: mapImage.height }}
              onClick={handleCanvasClick}
            >
              <img
                src={mapImage.src}
                width={mapImage.width}
                height={mapImage.height}
                alt="Plano de la Facultad de Ciencias Médicas (UNR)"
                className="pointer-events-none block h-full w-full select-none"
                draggable={false}
              />
              {locations.map((location) => (
                <CampusMarker
                  key={location.id}
                  location={location}
                  isSelected={location.id === selectedId}
                  onSelect={focusLocation}
                />
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>

        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => transformRef.current?.zoomIn()}
            aria-label="Acercar"
            className="border-border bg-surface text-text-secondary ease-standard hover:bg-surface-alt inline-flex size-9 items-center justify-center rounded-full border shadow-md transition-colors duration-150"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => transformRef.current?.zoomOut()}
            aria-label="Alejar"
            className="border-border bg-surface text-text-secondary ease-standard hover:bg-surface-alt inline-flex size-9 items-center justify-center rounded-full border shadow-md transition-colors duration-150"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => transformRef.current?.resetTransform()}
            aria-label="Restablecer vista"
            className="border-border bg-surface text-text-secondary ease-standard hover:bg-surface-alt inline-flex size-9 items-center justify-center rounded-full border shadow-md transition-colors duration-150"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </button>
        </div>

        {selectedLocation && (
          <CampusLocationPanel location={selectedLocation} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  );
}
