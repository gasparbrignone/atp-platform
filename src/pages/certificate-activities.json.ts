/**
 * Endpoint estático (build time, no runtime — mismo patrón que
 * actividades-newsletter.json.ts y search-index.json.ts) con las
 * actividades que piden certificado (`registration.collectCertificateData`)
 * y sus encuentros — lo consume /staff/escanear/ para armar el
 * desplegable de "Actividad" + "Encuentro" en vez de que el staff los
 * tipee a mano, y más adelante también /staff/certificados/.
 *
 * `encounters: null` significa "no hay una lista finita de encuentros
 * conocida de antemano" (actividad recurrente, sin sessions[] cargadas) —
 * para esos casos puntuales, la pantalla de escaneo cae de vuelta a un
 * campo de texto libre, igual que antes.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

interface CertificateActivity {
  id: string;
  title: string;
  encounters: string[] | null;
}

function getEncounters(activity: {
  sessions?: { title: string }[] | null;
  schedule?: { recurring?: boolean | null } | null;
}): string[] | null {
  if (activity.sessions && activity.sessions.length > 0) {
    return activity.sessions.map((session) => session.title);
  }
  if (activity.schedule && !activity.schedule.recurring) {
    return ['Único encuentro'];
  }
  // Recurrente (se repite todas las semanas) o sin horario cargado — no
  // hay una lista finita de encuentros para ofrecer de antemano.
  return null;
}

export const GET: APIRoute = async () => {
  const activities = await getCollection(
    'activities',
    ({ data }) => data.published && data.registration?.collectCertificateData === true,
  );

  const items: CertificateActivity[] = activities.map((activity) => ({
    id: activity.id,
    title: activity.data.title,
    encounters: getEncounters(activity.data),
  }));

  return new Response(JSON.stringify({ activities: items }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
