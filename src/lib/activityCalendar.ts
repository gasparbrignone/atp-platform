/**
 * Builds the day-by-day grid behind ActivityCalendar.astro. Kept separate
 * from the component (same split as activitySchedule.ts) so the placement
 * logic — which activity falls on which date — is unit-testable in
 * isolation from markup.
 *
 * Only two kinds of activity can be placed on a specific date: `recurring`
 * ones (every occurrence of their `weekday`) and one-off ones with a `date`.
 * A compound activity's individual `sessions` (see content.config.ts) have
 * no `date` of their own, only a `weekday` label — there's no calendar date
 * to place them on, so they're intentionally left off the grid; the
 * listing pages already cover them via their "N encuentros" summary.
 */
import type { Weekday } from '@/lib/labels';

interface CalendarActivityInput {
  id: string;
  title: string;
  recurring?: boolean | null;
  weekday?: Weekday | null;
  date?: string | null;
  time?: string | null;
}

export interface CalendarMarker {
  id: string;
  title: string;
  time: string | null;
}

export interface CalendarDay {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  activities: CalendarMarker[];
}

export interface CalendarMonth {
  year: number;
  /** 0-indexed, same as `Date#getMonth`. */
  month: number;
  label: string;
  weeks: CalendarDay[][];
}

const WEEKDAY_ORDER: Weekday[] = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
];

// Local calendar date, not `toISOString()` (UTC): converting a local
// evening timestamp to UTC can roll it into the next calendar day for any
// timezone behind UTC (Argentina included), which would mark "today"
// wrong for the second half of every day.
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return toIsoDate(a) === toIsoDate(b);
}

export function buildCalendarMonth(
  activities: CalendarActivityInput[],
  year: number,
  month: number,
  today: Date = new Date(),
): CalendarMonth {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // lunes = 0
  const gridStart = new Date(year, month, 1 - firstWeekday);

  const days: CalendarDay[] = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const weekday = WEEKDAY_ORDER[(date.getDay() + 6) % 7];
    const iso = toIsoDate(date);

    const dayActivities = activities
      .filter((activity) =>
        activity.recurring ? activity.weekday === weekday : activity.date === iso,
      )
      .map((activity) => ({ id: activity.id, title: activity.title, time: activity.time ?? null }))
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

    return {
      date,
      inMonth: date.getMonth() === month,
      isToday: isSameDay(date, today),
      activities: dayActivities,
    };
  });

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const rawLabel = firstOfMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return {
    year,
    month,
    // Solo la primera letra: `text-transform: capitalize` en CSS
    // mayusculizaría también la "de" ("Julio De 2026"), incorrecto en
    // español — acá se resuelve una vez en los datos en vez de en estilo.
    label: rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1),
    weeks,
  };
}
