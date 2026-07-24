/**
 * Endpoint estático (se genera en build time, no en runtime) que expone las
 * actividades destacadas y publicadas como JSON — lo consume el Apps Script
 * de mails de inscripción (ver docs/GOOGLE_SHEETS_FORM_SETUP.md) para armar
 * el bloque "Próximas actividades" del mail de confirmación sin tener que
 * hardcodear ni reeditar ese contenido en el script cada vez que cambia.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

export const GET: APIRoute = async () => {
  const activities = await getCollection(
    'activities',
    ({ data }) => data.published && data.featured && data.status !== 'finalizada',
  );

  const items = activities
    .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
    .slice(0, 4)
    .map((activity) => ({
      title: activity.data.title,
      summary: activity.data.summary,
      url: `https://atpfcm.com.ar/actividades/${activity.id}`,
    }));

  return new Response(JSON.stringify({ activities: items }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
