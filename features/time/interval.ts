import { parseClockTime, parseDuration } from "@/lib/time-input";
import { isIsoDate, shiftIsoDate, zonedInstant } from "@/lib/zoned";

/**
 * Turns what someone typed for a manual block (a day, a start time, and an
 * end time or duration) into two instants in their time zone.
 *
 * - An end at or before the start means the block crosses midnight.
 * - The end field takes a duration when it has units ("1h30", "+45m").
 * - A block can't end in the future or last more than a day.
 */

export type IntervalError = "invalidDate" | "invalidStart" | "invalidEnd" | "tooShort" | "tooLong" | "future";

export type IntervalResult =
  | { ok: true; startedAt: Date; endedAt: Date; minutes: number }
  | { ok: false; errors: Partial<Record<"date" | "start" | "end", IntervalError>> };

const MAX_MINUTES = 24 * 60;

export function buildInterval(input: {
  date: string;
  start: string;
  end: string;
  timeZone: string;
  now: Date;
}): IntervalResult {
  const errors: Partial<Record<"date" | "start" | "end", IntervalError>> = {};

  const dateOk = isIsoDate(input.date);
  if (!dateOk) errors.date = "invalidDate";

  const startMinutes = parseClockTime(input.start);
  if (startMinutes === null) errors.start = "invalidStart";

  const endText = input.end.trim();
  const isDuration = endText.startsWith("+") || /[hm]/i.test(endText);
  const endValue = isDuration ? parseDuration(endText.replace(/^\+/, "")) : parseClockTime(endText);
  if (endValue === null) errors.end = "invalidEnd";

  if (!dateOk || startMinutes === null || endValue === null) return { ok: false, errors };

  const startedAt = zonedInstant(input.date, startMinutes, input.timeZone);
  let endedAt: Date;

  if (isDuration) {
    endedAt = new Date(startedAt.getTime() + endValue * 60_000);
  } else {
    if (endValue === startMinutes) return { ok: false, errors: { end: "tooShort" } };
    const endDate = endValue < startMinutes ? shiftIsoDate(input.date, 1) : input.date;
    endedAt = zonedInstant(endDate, endValue, input.timeZone);
  }

  const minutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000);
  if (minutes <= 0) return { ok: false, errors: { end: "tooShort" } };
  if (minutes > MAX_MINUTES) return { ok: false, errors: { end: "tooLong" } };
  if (endedAt.getTime() > input.now.getTime()) return { ok: false, errors: { end: "future" } };

  return { ok: true, startedAt, endedAt, minutes };
}
