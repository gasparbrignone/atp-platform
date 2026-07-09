import { matchesAllWords, normalizeText } from '@/lib/textSearch';

export interface CampusLocation {
  id: string;
  name: string;
  category: string;
  description: string | null;
  instructions: string | null;
  aliases: string[];
  video: string | null;
  x: number;
  y: number;
}

/**
 * Coincidencias por `name` primero, por `aliases` después — así "bedelia"
 * encuentra "Departamento de Alumnos" (alias) sin que un alias corto le
 * gane el primer puesto a una coincidencia directa del nombre real.
 */
export function searchCampusLocations(
  locations: CampusLocation[],
  query: string,
  limit = 6,
): CampusLocation[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery.trim()) return [];

  const scored = locations
    .map((location) => {
      if (matchesAllWords(normalizedQuery, normalizeText(location.name))) {
        return { location, score: 2 };
      }
      const aliasMatch = location.aliases.some((alias) =>
        matchesAllWords(normalizedQuery, normalizeText(alias)),
      );
      if (aliasMatch) return { location, score: 1 };
      return null;
    })
    .filter((entry): entry is { location: CampusLocation; score: number } => entry !== null);

  return scored
    .sort((a, b) => b.score - a.score || a.location.name.localeCompare(b.location.name))
    .slice(0, limit)
    .map((entry) => entry.location);
}
