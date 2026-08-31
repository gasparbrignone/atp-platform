/**
 * Endpoint estático (build time) con el cronograma vigente de cada actividad
 * publicada y no finalizada, por `activityId`. Lo consume el Apps Script
 * (`sendReminders`, ver docs/GOOGLE_SHEETS_FORM_SETUP.md) para no mandar
 * recordatorios basados en la foto que quedó guardada el día de la
 * inscripción: si una actividad se borra o despublica, su id deja de
 * aparecer acá y el script deja de recordarla; si se le edita la fecha/hora/
 * lugar, el script usa el dato nuevo de acá en vez del viejo de la planilla.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getReminderSessions } from '@/lib/activitySchedule';

export const prerender = true;

export const GET: APIRoute = async () => {
  const activities = await getCollection(
    'activities',
    ({ data }) => data.published && data.status !== 'finalizada',
  );

  const bySessionId = Object.fromEntries(
    activities.map((activity) => [activity.id, getReminderSessions(activity.data)]),
  );

  return new Response(JSON.stringify({ activities: bySessionId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
