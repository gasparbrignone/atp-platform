/**
 * Búsqueda tolerante a errores de tipeo y tildes (ej. "neter"/"more"/"pro"
 * debe encontrar "Netter"/"Moore"/"Pró"): se normaliza (sin acentos) y se
 * compara por palabra con distancia de edición, no con `includes()` exacto.
 * Compartido por Biblioteca y Calendario académico — antes vivía duplicado
 * inline en ambos.
 */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function levenshteinDistance(a: string, b: string): number {
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
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Qué tan bien coincide una palabra (menor = mejor; null = no coincide):
 * exacta < empieza igual < la contiene < error de tipeo. Sin este orden,
 * "abbas" encontraba los 13 "atlas" (a 2 letras de distancia) y el Abbas
 * quedaba último.
 */
function wordMatchRank(queryWord: string, candidateWord: string): number | null {
  if (candidateWord === queryWord) return 0;
  if (candidateWord.startsWith(queryWord)) return 1;
  if (candidateWord.includes(queryWord)) return 2;
  const maxDistance = queryWord.length <= 4 ? 1 : 2;
  const distance = levenshteinDistance(queryWord, candidateWord);
  return distance <= maxDistance ? 2 + distance : null;
}

export function wordMatches(queryWord: string, candidateWord: string): boolean {
  return wordMatchRank(queryWord, candidateWord) !== null;
}

export function toSearchWords(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Relevancia de un resultado (menor = mejor; null = no coincide): suma, por
 * cada palabra buscada, su mejor coincidencia. Para ordenar resultados.
 */
export function queryRank(query: string, candidateWords: string[]): number | null {
  let total = 0;
  for (const queryWord of toSearchWords(query)) {
    let best: number | null = null;
    for (const word of candidateWords) {
      const rank = wordMatchRank(queryWord, word);
      if (rank !== null && (best === null || rank < best)) best = rank;
    }
    if (best === null) return null;
    total += best;
  }
  return total;
}

export function matchesQuery(query: string, candidateWords: string[]): boolean {
  return queryRank(query, candidateWords) !== null;
}
