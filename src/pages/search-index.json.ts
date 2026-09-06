/**
 * Endpoint estático (build time, no runtime — mismo patrón que
 * actividades-newsletter.json.ts) que junta actividades, herramientas,
 * carreras y libros publicados en un solo índice liviano para el buscador
 * global (ver src/components/GlobalSearch.astro). Sin backend nuevo: es
 * JSON generado en el build, como cualquier otra página estática.
 *
 * `text` es el campo que el cliente busca (título + lo que ayude a
 * encontrarlo — resumen, autor, descripción en texto plano); `title`/
 * `subtitle` son solo para mostrar el resultado. Los libros no tienen
 * página propia (ver biblioteca.astro) — su url apunta a `/biblioteca/`
 * con `?q=` para que esa página pre-cargue la búsqueda con el título.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getActivityTiming } from '@/lib/activitySchedule';
import { markdownToPlainText } from '@/lib/markdown';

export const prerender = true;

interface SearchItem {
  type: 'actividad' | 'herramienta' | 'carrera' | 'libro';
  title: string;
  subtitle: string;
  text: string;
  url: string;
}

export const GET: APIRoute = async () => {
  const activities = await getCollection('activities', ({ data }) => data.published);
  const activityItems: SearchItem[] = activities
    .filter((activity) => getActivityTiming(activity.data.schedule ?? {}) !== 'past')
    .map((activity) => ({
      type: 'actividad',
      title: activity.data.title,
      subtitle: activity.data.summary,
      text: `${activity.data.title} ${activity.data.summary}`,
      url: `/actividades/${activity.id}/`,
    }));

  const tools = await getCollection('tools', ({ data }) => data.published);
  const toolItems: SearchItem[] = tools.map((tool) => {
    const plainDescription = markdownToPlainText(tool.data.description);
    return {
      type: 'herramienta',
      title: tool.data.name,
      subtitle: plainDescription,
      text: `${tool.data.name} ${plainDescription}`,
      url: `/herramientas/${tool.id}/`,
    };
  });

  const careers = await getCollection('careers');
  const careerItems: SearchItem[] = careers.map((career) => ({
    type: 'carrera',
    title: career.data.name,
    subtitle: career.data.description ?? '',
    text: `${career.data.name} ${career.data.description ?? ''}`,
    url: `/carreras/${career.id}/`,
  }));

  const books = await getCollection('books', ({ data }) => data.published);
  const bookItems: SearchItem[] = books.map((book) => ({
    type: 'libro',
    title: book.data.title,
    subtitle: book.data.author,
    text: `${book.data.title} ${book.data.author}`,
    url: `/biblioteca/?q=${encodeURIComponent(book.data.title)}`,
  }));

  const items = [...activityItems, ...toolItems, ...careerItems, ...bookItems];

  return new Response(JSON.stringify({ items }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
