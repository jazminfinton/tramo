import { addMonths, formatDateInput, fromIsoDate, monthsShowing } from "@/lib/dates";
import { isoDaysBetween } from "@/lib/zoned";

// A range of calendar days, for a calendar that picks one. Days travel as ISO
// dates ("2026-09-23"), which sort as text: comparing them compares the days.

/** Two calendar days, the first and the last, both included. */
export type DayRange = { from: string; to: string };

/** The range two picked days make, whichever was picked first. */
export function rangeOf(a: string, b: string): DayRange {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

export type RangePosition = "start" | "end" | "only" | "inside" | "outside";

/** Where a day sits in a range: at one of its ends, between them, or outside it. */
export function positionIn(day: string, range: DayRange | null): RangePosition {
  if (!range || day < range.from || day > range.to) return "outside";
  if (range.from === range.to) return "only";
  if (day === range.from) return "start";
  return day === range.to ? "end" : "inside";
}

export type PickLimits = {
  /** The last day that can be picked. */
  max?: string;
  /** The first day, once it's picked: the second has to be within reach of it. */
  anchor?: string | null;
  /** The most days a range can cover, both ends included. */
  maxDays?: number;
};

/** Whether a day can be picked under the calendar's limits. */
export function isPickable(day: string, { max, anchor, maxDays }: PickLimits): boolean {
  if (max !== undefined && day > max) return false;
  if (anchor && maxDays !== undefined) return Math.abs(isoDaysBetween(anchor, day)) < maxDays;
  return true;
}

/** A range as its control writes it: both days the way dates are typed, a one-day range once. */
export function formatDayRange({ from, to }: DayRange): string {
  const write = (isoDate: string) => {
    const date = fromIsoDate(isoDate);
    return date ? formatDateInput(date) : isoDate;
  };
  return from === to ? write(from) : `${write(from)} – ${write(to)}`;
}

/**
 * The first of the `count` months a calendar opens on to show a range: the
 * months the range is in, with its last day always on show. With a last day
 * that can be picked (`max`), it doesn't open on a month past it: next to the
 * current month goes the one before, not one nobody can pick from.
 */
export function openingMonth(range: DayRange, count: number, max?: string): Date {
  const limit = max === undefined ? null : fromIsoDate(max);
  const last = (max !== undefined && range.to > max ? limit : fromIsoDate(range.to)) ?? new Date();
  const opening = monthsShowing(fromIsoDate(range.from) ?? last, count, last);
  if (!limit) return opening;

  const latest = addMonths(monthsShowing(limit, 1, limit), 1 - count);
  return opening > latest ? latest : opening;
}
