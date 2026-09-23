// Calendar dates (ported from Fragua): writing them, reading them, and laying
// out a month grid. A calendar date is a DAY, not an instant, so everything is
// built in local time — the date someone types is the one on their calendar.
// Turning a day plus a time into an instant in someone's zone is lib/zoned.ts.

// Dates are built at NOON, not midnight: adding 24 hours to a midnight lands
// on the wrong day when clocks change. Noon leaves twelve hours each way.
const NOON = 12;

/** A local Date at noon, or null if that day doesn't exist. */
function build(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day, NOON);
  // Date happily turns Feb 31 into Mar 3; comparing is what catches it.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** `31/12/2026`, with `/`, `-` or `.`, with or without leading zeros. */
export function parseDateInput(value: string): Date | null {
  const parts = value.trim().split(/[/\-.]/);
  if (parts.length !== 3) return null;

  const [day = "", month = "", year = ""] = parts;
  // The year is required in full: "26" could be 1926 or 2026.
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;

  return build(Number(year), Number(month), Number(day));
}

/** `2026-12-31`: how a date travels to the server. */
export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return build(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** `31/12/2026`: how a date is shown and typed. */
export function formatDateInput(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function monthLabel(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}

/** The twelve month names from Intl, so there's no hand-written list to translate. */
export function monthNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { month: "long" });
  return Array.from({ length: 12 }, (_, month) => format.format(new Date(2026, month, 1, NOON)));
}

/** Short weekday names, Monday first. */
export function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 2026-09-21 is a Monday.
  return Array.from({ length: 7 }, (_, day) => format.format(new Date(2026, 8, 21 + day, NOON)));
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Adds months without spilling over: Jan 31 + 1 month is Feb 28, not Mar 3. */
export function addMonths(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const lastOfTarget = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastOfTarget), NOON);
}

/**
 * The six Monday-first weeks drawn for a month: always 42 days, so the grid
 * doesn't change height (and shift the button under your finger) per month.
 */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1, NOON);
  const offset = (first.getDay() + 6) % 7; // getDay() is 0 for Sunday
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first);
    day.setDate(first.getDate() - offset + index);
    return day;
  });
}
