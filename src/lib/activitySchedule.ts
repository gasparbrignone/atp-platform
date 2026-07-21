/**
 * Builds the human-readable "meta" line (día/hora/lugar) shown on activity
 * cards and the detail page. Split out from src/pages/actividades*.astro
 * because it now branches on `recurring`: a weekly activity (ej. "todos los
 * miércoles") shows its weekday instead of a one-off `date` that someone
 * would otherwise have to keep editing every week to avoid looking stale.
 */
import { weekdayLabels, type Weekday } from '@/lib/labels';

interface ActivityScheduleInput {
  recurring?: boolean | null;
  weekday?: Weekday | null;
  date?: string | null;
  time?: string | null;
  endTime?: string | null;
  location?: string | null;
}

function formatTimeRange(time?: string | null, endTime?: string | null): string | null {
  if (time && endTime) return `${time} a ${endTime}hs`;
  if (time) return `${time}hs`;
  return null;
}

export function getActivityScheduleLabel(activity: ActivityScheduleInput): string {
  const timeRange = formatTimeRange(activity.time, activity.endTime);

  // `weekday` sin `recurring` es una sesión suelta de una actividad
  // compuesta (ver `sessions` en content.config.ts): un encuentro puntual
  // dentro de una serie, no algo que se repita semana a semana — por eso
  // el label es solo "Miércoles de...", no "Todos los miércoles de...".
  // Si la sesión tiene `weekday` Y `date` cargados a la vez, gana `weekday`
  // (rama debajo) — el CMS permite cargar ambos pero solo uno se muestra.
  if (activity.weekday) {
    const label = weekdayLabels[activity.weekday];
    // Plural en español: los días que ya terminan en "s" (lunes, miércoles,
    // ...) no cambian en plural — solo sábado/domingo suman una "s".
    const plural = label.endsWith('s') ? label : `${label}s`;
    const weekdayPart = activity.recurring
      ? `Todos los ${plural}`
      : label.charAt(0).toUpperCase() + label.slice(1);
    return [timeRange ? `${weekdayPart} de ${timeRange}` : weekdayPart, activity.location]
      .filter(Boolean)
      .join(' · ');
  }

  return [activity.date, timeRange, activity.location].filter(Boolean).join(' · ');
}

export type ActivityTiming = 'this-week' | 'upcoming' | 'past';

// Semana calendario lunes-domingo, no "próximos 7 días" — así "esta semana"
// coincide con lo que alguien esperaría al ver un calendario real.
function startOfWeek(reference: Date): Date {
  const start = new Date(reference);
  const isoWeekday = (start.getDay() + 6) % 7; // lunes = 0 ... domingo = 6
  start.setDate(start.getDate() - isoWeekday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfWeek(reference: Date): Date {
  const end = startOfWeek(reference);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Una actividad `recurring` pasa siempre como "this-week": se repite todas
 * las semanas, así que técnicamente siempre está pasando esta semana — no
 * tiene sentido evaluarla contra una fecha puntual que no tiene.
 *
 * Para una actividad puntual (con `date`), se compara contra la semana
 * calendario actual. Como el sitio es estático y solo se reconstruye
 * cuando se pushea contenido (ver CLAUDE.md / migrate-drive-books), esto
 * puede quedar desactualizado entre pushes — igual que ya pasaba con
 * cualquier otro contenido con fecha del sitio.
 */
export function getActivityTiming(
  activity: Pick<ActivityScheduleInput, 'recurring' | 'date'>,
  now: Date = new Date(),
): ActivityTiming {
  if (activity.recurring) return 'this-week';
  if (!activity.date) return 'upcoming';

  const date = new Date(`${activity.date}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'upcoming';

  if (date < startOfWeek(now)) return 'past';
  if (date > endOfWeek(now)) return 'upcoming';
  return 'this-week';
}
