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

export function wordMatches(queryWord: string, candidateWord: string): boolean {
  if (candidateWord.includes(queryWord)) return true;
  const maxDistance = queryWord.length <= 4 ? 1 : 2;
  return levenshteinDistance(queryWord, candidateWord) <= maxDistance;
}

export function toSearchWords(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function matchesQuery(query: string, candidateWords: string[]): boolean {
  const queryWords = toSearchWords(query);
  if (queryWords.length === 0) return true;
  return queryWords.every((queryWord) =>
    candidateWords.some((word) => wordMatches(queryWord, word)),
  );
}
