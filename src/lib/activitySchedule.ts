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

  if (activity.recurring && activity.weekday) {
    const weekdayPart = `Todos los ${weekdayLabels[activity.weekday]}`;
    return [timeRange ? `${weekdayPart} de ${timeRange}` : weekdayPart, activity.location]
      .filter(Boolean)
      .join(' · ');
  }

  return [activity.date, timeRange, activity.location].filter(Boolean).join(' · ');
}
