/**
 * Tolerancia a tildes/tipeos genérica — misma técnica que la búsqueda de
 * Biblioteca (src/pages/biblioteca.astro), extraída acá porque el mapa de
 * la facultad (src/components/CampusMap) la necesita también y ninguna de
 * las dos vive en el mismo runtime (una es un <script> de Astro, la otra
 * un componente React).
 */

export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Una palabra de la búsqueda matchea una palabra del texto si es
 * substring, o si difiere por a lo sumo un error de tipeo (más tolerancia
 * en palabras largas, ninguna en palabras de 1-2 letras para no generar
 * falsos positivos).
 */
export function wordMatches(queryWord: string, textWord: string): boolean {
  if (textWord.includes(queryWord)) return true;
  const maxErrors = queryWord.length <= 2 ? 0 : queryWord.length <= 5 ? 1 : 2;
  return levenshtein(queryWord, textWord) <= maxErrors;
}

/**
 * true si cada palabra de `query` matchea alguna palabra de `haystack`
 * (ambos ya deberían pasar por `normalizeText` antes de llamar a esto).
 */
export function matchesAllWords(query: string, haystack: string): boolean {
  const queryWords = query.trim().split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return false;
  const haystackWords = haystack.split(/[^a-z0-9]+/).filter(Boolean);
  return queryWords.every((qw) => haystackWords.some((hw) => wordMatches(qw, hw)));
}
