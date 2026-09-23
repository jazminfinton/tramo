/**
 * Parsers for the smart time fields: people type times and durations the way
 * they say them, and the field shows how it understood them. A time field
 * uses the text input the browser already makes good on every device; only
 * the interpretation is ours.
 */

const CLOCK_WITH_SEPARATOR = /^(\d{1,2})[:.](\d{2})$/;
const CLOCK_COMPACT = /^(\d{3,4})$/;
const CLOCK_HOUR_ONLY = /^(\d{1,2})$/;

/** A time of day ("14:30", "1430", "930", "14") in minutes since midnight. */
export function parseClockTime(text: string): number | null {
  const value = text.trim();
  let hours: number;
  let minutes: number;

  const separated = CLOCK_WITH_SEPARATOR.exec(value);
  const compact = CLOCK_COMPACT.exec(value);
  const hourOnly = CLOCK_HOUR_ONLY.exec(value);

  if (separated) {
    hours = Number(separated[1]);
    minutes = Number(separated[2]);
  } else if (compact) {
    const number = Number(compact[1]);
    hours = Math.floor(number / 100);
    minutes = number % 100;
  } else if (hourOnly) {
    hours = Number(hourOnly[1]);
    minutes = 0;
  } else {
    return null;
  }

  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const DURATION_HOURS =
  /^(\d+(?:\.\d+)?)\s*h(?:s|rs?|oras?)?(?:\s*(\d{1,2})\s*(?:m|min|mins|minutos?)?)?$/;
const DURATION_MINUTES = /^(\d+)\s*(?:m|min|mins|minutos?)$/;
const DURATION_CLOCK = /^(\d{1,3}):([0-5]\d)$/;

/**
 * A duration ("1h30", "1h 30m", "90m", "1,5h", "1:30") in minutes. Bare
 * numbers need a unit, so a time is never mistaken for a duration.
 */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase().replace(",", ".");

  const clock = DURATION_CLOCK.exec(value);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const hours = DURATION_HOURS.exec(value);
  if (hours) return Math.round(Number(hours[1]) * 60 + Number(hours[2] ?? 0));

  const minutes = DURATION_MINUTES.exec(value);
  if (minutes) return Number(minutes[1]);

  return null;
}
