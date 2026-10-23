/**
 * Búsquedas de la Biblioteca registradas en GoatCounter (eventos
 * `busqueda:<texto>`, ver el script de biblioteca.astro) en los últimos
 * `days` días, vía la API de GoatCounter. Se llama en build time (Astro
 * static: corre en Node durante `astro build`, el token nunca llega al
 * cliente) — el deploy diario (.github/workflows/deploy.yml) las mantiene
 * al día.
 *
 * Nunca tira si falla: sin token, sin red, rate limit o respuesta
 * inesperada devuelven `[]` en vez de romper el build — mismo criterio que
 * src/lib/youtube.ts. El caller decide qué mostrar sin datos.
 *
 * La API no filtra por nombre: primero lista las rutas (paginando con
 * `after`), se queda con las de búsqueda, y después pide sus visitas.
 */
import { siteConfig } from '@/config/site';

export interface SearchCount {
  query: string;
  count: number;
}

const SEARCH_PREFIX = 'busqueda:';
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

interface ApiPath {
  id: number;
  path: string;
  event: boolean;
}

interface ApiHit {
  path_id: number;
  path: string;
  count: number;
}

async function apiGet<T>(
  endpoint: string,
  params: Record<string, string>,
  token: string,
): Promise<T> {
  const url = new URL(`https://${siteConfig.goatcounterSite}.goatcounter.com/api/v0/${endpoint}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  // Un reintento: la API devolvió un 404 pasajero en pruebas reales, y un
  // solo tropiezo dejaría el día entero con las pills de respaldo.
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (response.ok) return (await response.json()) as T;
    if (attempt >= 2) throw new Error(`GoatCounter ${endpoint}: HTTP ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function listSearchPaths(token: string): Promise<ApiPath[]> {
  const found: ApiPath[] = [];
  let after = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await apiGet<{ paths?: ApiPath[]; more?: boolean }>(
      'paths',
      { limit: String(PAGE_SIZE), after: String(after) },
      token,
    );
    const paths = data.paths ?? [];
    found.push(...paths.filter((p) => p.event && p.path.startsWith(SEARCH_PREFIX)));
    if (!data.more || paths.length === 0) break;
    after = paths[paths.length - 1].id;
  }
  return found;
}

function hourRounded(date: Date): string {
  const copy = new Date(date);
  copy.setUTCMinutes(0, 0, 0);
  return copy.toISOString();
}

export async function getRecentLibrarySearches(days = 30): Promise<SearchCount[]> {
  const token = import.meta.env.GOATCOUNTER_API_TOKEN;
  if (!token) return [];

  try {
    const searchPaths = await listSearchPaths(token);
    if (searchPaths.length === 0) return [];

    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const counts: SearchCount[] = [];
    for (let i = 0; i < searchPaths.length; i += PAGE_SIZE) {
      const ids = searchPaths.slice(i, i + PAGE_SIZE).map((p) => p.id);
      const data = await apiGet<{ hits?: ApiHit[] }>(
        'stats/hits',
        {
          start: hourRounded(start),
          end: hourRounded(end),
          limit: String(PAGE_SIZE),
          include_paths: ids.join(','),
        },
        token,
      );
      for (const hit of data.hits ?? []) {
        if (hit.count > 0 && hit.path.startsWith(SEARCH_PREFIX)) {
          counts.push({ query: hit.path.slice(SEARCH_PREFIX.length), count: hit.count });
        }
      }
    }
    return counts;
  } catch {
    return [];
  }
}
