import { useId, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import type { CampusLocation } from '@/lib/campusSearch';

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  suggestions: CampusLocation[];
  onSelect: (id: string) => void;
}

/** Combobox ARIA: input + listbox de sugerencias, navegable con flechas. */
export default function CampusMapSearch({ query, onQueryChange, suggestions, onSelect }: Props) {
  const [activeIndex, setActiveIndex] = useState(-1);
  // Tras elegir una sugerencia, `query` pasa a ser el nombre del lugar
  // elegido — que sigue matcheando a sí mismo — así que sin este flag el
  // listado quedaría abierto mostrando ese único resultado para siempre.
  const [dismissed, setDismissed] = useState(false);
  const listboxId = useId();

  const isOpen = suggestions.length > 0 && !dismissed;

  function selectSuggestion(location: CampusLocation) {
    onSelect(location.id);
    onQueryChange(location.name);
    setActiveIndex(-1);
    setDismissed(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      onQueryChange('');
      setActiveIndex(-1);
    }
  }

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search
          className="text-text-secondary pointer-events-none absolute left-3 size-4"
          aria-hidden="true"
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setActiveIndex(-1);
            setDismissed(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder='Buscá un aula, oficina o "bedelía"...'
          className="border-border bg-surface text-text placeholder:text-text-secondary focus:border-secondary-strong ease-standard text-body-sm w-full rounded-md border py-2.5 pr-3 pl-9 transition-colors duration-150 outline-none"
        />
      </div>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="bg-surface border-border absolute top-full right-0 left-0 z-20 mt-1 flex max-h-64 flex-col overflow-y-auto rounded-md border shadow-lg"
        >
          {suggestions.map((location, index) => (
            <li
              key={location.id}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(location)}
                className={
                  'ease-standard flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors duration-150 ' +
                  (index === activeIndex ? 'bg-surface-alt' : 'hover:bg-surface-alt')
                }
              >
                <span className="text-body-sm text-text font-semibold">{location.name}</span>
                <span className="text-caption text-text-secondary">{location.category}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
