import { TZDate } from "@date-fns/tz";
import { startOfWeek } from "date-fns";

/**
 * Days and weeks in a person's own time zone. Instants are stored in UTC;
 * which DAY a block belongs to depends on where its person lives, and a week
 * is Monday 00:00 to Monday 00:00 on their clock — 169 hours on the week the
 * clocks go back, 167 when they go forward.
 *
 * Calendar dates travel as ISO strings ("2026-09-23"), never as Date objects,
 * so no code can accidentally read them in the server's zone.
 */

const pad = (value: number) => String(value).padStart(2, "0");

function isoParts(isoDate: string): [number, number, number] {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);
  return [year, month, day];
}

/** The instant at `minutesOfDay` on `isoDate`, on the clock of `timeZone`. */
export function zonedInstant(isoDate: string, minutesOfDay: number, timeZone: string): Date {
  const [year, month, day] = isoParts(isoDate);
  const local = new TZDate(year, month - 1, day, Math.floor(minutesOfDay / 60), minutesOfDay % 60, timeZone);
  return new Date(local.getTime());
}

/** The calendar day an instant falls on in `timeZone`. */
export function zonedDateKey(instant: Date, timeZone: string): string {
  const local = new TZDate(instant.getTime(), timeZone);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

/** Minutes since local midnight of an instant in `timeZone`. */
export function zonedMinutesOfDay(instant: Date, timeZone: string): number {
  const local = new TZDate(instant.getTime(), timeZone);
  return local.getHours() * 60 + local.getMinutes();
}

/** The Monday (ISO date) of the week an instant falls in, in `timeZone`. */
export function zonedWeekStart(instant: Date, timeZone: string): string {
  const monday = startOfWeek(new TZDate(instant.getTime(), timeZone), { weekStartsOn: 1 });
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}

/** Calendar arithmetic on ISO dates, independent of any zone. */
export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoParts(isoDate);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** A local week: its bounds as instants and its seven calendar days. */
export function weekRange(weekStart: string, timeZone: string) {
  return {
    start: zonedInstant(weekStart, 0, timeZone),
    end: zonedInstant(shiftIsoDate(weekStart, 7), 0, timeZone),
    days: Array.from({ length: 7 }, (_, index) => shiftIsoDate(weekStart, index)),
  };
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return shiftIsoDate(value, 0) === value;
}
