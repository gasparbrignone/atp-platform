/**
 * Junta las ediciones de un mismo libro (mismo título, autor, materia y
 * tipo — ej. Moore 6.ª y 7.ª) para que la Biblioteca muestre una sola fila
 * con selector de edición en vez de varias casi iguales. En el CMS cada
 * edición sigue siendo su propia entrada.
 */
import type { CollectionEntry } from 'astro:content';
import { toSearchWords } from '@/lib/textSearch';

type Book = CollectionEntry<'books'>;

/** Cada grupo, de la edición más nueva a la más vieja (sin número, al final). */
export function groupBookEditions(books: Book[]): Book[][] {
  const groups = new Map<string, Book[]>();
  for (const book of books) {
    const { title, author, subject, resourceType } = book.data;
    const key = [title, author, subject, resourceType]
      .map((part) => toSearchWords(part).join(' '))
      .join('|');
    groups.set(key, [...(groups.get(key) ?? []), book]);
  }
  return [...groups.values()].map((editions) =>
    editions.sort((a, b) => (b.data.edition ?? 0) - (a.data.edition ?? 0)),
  );
}
