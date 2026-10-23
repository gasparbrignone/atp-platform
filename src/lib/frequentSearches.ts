/**
 * Arma las pills de "búsquedas frecuentes" de la Biblioteca a partir de lo
 * que la gente buscó (src/lib/goatcounter.ts). Lo que se muestra es
 * público, así que solo pasan búsquedas que:
 *  - encuentran al menos un libro publicado (descarta basura, tipeos sin
 *    resultado y cualquier texto que no tenga que ver con la biblioteca);
 *  - las buscó más de una vez (no expone la búsqueda suelta de una persona).
 * Las búsquedas a medio escribir o con errores ("guyt", "robins") se suman
 * a la palabra real de los libros ("guyton", "robbins"). Si no alcanzan,
 * se completa con `fallback` (las materias con más libros), así las pills
 * nunca quedan vacías.
 */
import type { SearchCount } from '@/lib/goatcounter';
import { matchesQuery, normalizeText, toSearchWords, wordMatches } from '@/lib/textSearch';

export interface QuickSearch {
  label: string;
  query: string;
}

interface SearchableBook {
  /** Texto donde busca la Biblioteca: título, autor, materia. */
  text: string;
}

const MIN_COUNT = 2;
const MIN_LENGTH = 3;
const MAX_LENGTH = 40;

function cleanQuery(query: string): string {
  return toSearchWords(query).join(' ');
}

interface KnownWord {
  /** Cómo se escribe en los libros, con tildes y mayúsculas ("Anatomía"). */
  display: string;
  /** En cuántas palabras de los libros aparece: desempata correcciones. */
  uses: number;
}

/** Palabra normalizada ("anatomia") → cómo figura en los libros y cuánto se usa. */
function wordDictionary(books: SearchableBook[]): Map<string, KnownWord> {
  const dictionary = new Map<string, KnownWord>();
  for (const { text } of books) {
    for (const word of text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
      const key = normalizeText(word);
      const known = dictionary.get(key);
      if (known) known.uses += 1;
      else dictionary.set(key, { display: word, uses: 1 });
    }
  }
  return dictionary;
}

/**
 * Lleva cada palabra a la palabra real de los libros a la que apunta: la
 * misma si existe, la que empieza así si quedó a medio escribir ("guyt" →
 * "guyton"), o la más parecida si tiene un error ("robins" → "robbins"),
 * con la misma tolerancia que usa el buscador. Entre varias candidatas gana
 * la más usada en los libros ("anat" → "anatomia", no "anatomy" del único
 * atlas en inglés). Así la pill nunca muestra una palabra mal escrita.
 */
function canonicalQuery(query: string, dictionary: Map<string, KnownWord>): string {
  const known = [...dictionary.keys()];
  const mostUsed = (a: string, b: string) => dictionary.get(b)!.uses - dictionary.get(a)!.uses;
  return query
    .split(' ')
    .map((word) => {
      if (dictionary.has(word)) return word;
      const completed = known.filter((candidate) => candidate.startsWith(word)).sort(mostUsed);
      if (completed.length > 0) return completed[0];
      const corrected = known.filter((candidate) => wordMatches(word, candidate)).sort(mostUsed);
      return corrected[0] ?? word;
    })
    .join(' ');
}

function toLabel(query: string, dictionary: Map<string, KnownWord>): string {
  return query
    .split(' ')
    .map((word) => dictionary.get(word)?.display ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function buildFrequentSearches(
  searches: SearchCount[],
  books: SearchableBook[],
  fallback: QuickSearch[],
  max = 8,
): QuickSearch[] {
  const bookWords = books.map(({ text }) => toSearchWords(text));
  const dictionary = wordDictionary(books);

  // El filtro "encuentra algún libro" va ANTES de corregir palabras: si no,
  // una búsqueda basura podría "corregirse" hacia una palabra real.
  const totals = new Map<string, number>();
  for (const { query, count } of searches) {
    const clean = cleanQuery(query);
    if (clean.length < MIN_LENGTH || clean.length > MAX_LENGTH) continue;
    if (!bookWords.some((words) => matchesQuery(clean, words))) continue;
    const canonical = canonicalQuery(clean, dictionary);
    totals.set(canonical, (totals.get(canonical) ?? 0) + count);
  }

  // "berne" y "berne levy" (o "endemicas" y "enfermedades endemicas de la
  // argentina") apuntan al mismo libro: si todas las palabras de una
  // búsqueda están en otra, queda solo la más buscada.
  const chosen: string[] = [];
  const isWithin = (a: string, b: string) =>
    a.split(' ').every((word) => b.split(' ').includes(word));
  const overlaps = (a: string, b: string) => isWithin(a, b) || isWithin(b, a);
  for (const [query] of [...totals.entries()]
    .filter(([, count]) => count >= MIN_COUNT)
    .sort((a, b) => b[1] - a[1])) {
    if (chosen.length >= max) break;
    if (!chosen.some((other) => overlaps(query, other))) chosen.push(query);
  }
  const popular = chosen.map((query) => ({ label: toLabel(query, dictionary), query }));

  const seen = new Set(popular.map(({ query }) => cleanQuery(query)));
  for (const item of fallback) {
    if (popular.length >= max) break;
    if (seen.has(cleanQuery(item.query))) continue;
    popular.push(item);
    seen.add(cleanQuery(item.query));
  }
  return popular;
}
