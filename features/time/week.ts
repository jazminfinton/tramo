import { workedMs, type Timed } from "@/features/time/worked";
import { isIsoDate, zonedDateKey, zonedInstant, zonedWeekStart } from "@/lib/zoned";

type WeekEntry = Timed & { projectId: string };

export type WeekBuckets = {
  /** Minutes per key (a project, a person), one slot per day (Monday first). */
  byKey: Map<string, number[]>;
  dayTotals: number[];
  total: number;
};

/**
 * Adds a week of blocks into minutes per key and per day: per project by
 * default, per person for the team's week. A block counts entirely on the day
 * it started (owner's decision), for the time worked in it: its pauses are
 * left out, a running one counts up to `now` and a paused one up to its
 * pause. Days are read in the viewer's own time zone.
 */
export function bucketWeek<T extends WeekEntry>(
  entries: T[],
  days: string[],
  timeZone: string,
  now: Date,
  keyOf: (entry: T) => string = (entry) => entry.projectId,
): WeekBuckets {
  const dayIndex = new Map(days.map((day, index) => [day, index]));
  const byKey = new Map<string, number[]>();
  const dayTotals = days.map(() => 0);
  let total = 0;

  for (const entry of entries) {
    const index = dayIndex.get(zonedDateKey(entry.startedAt, timeZone));
    if (index === undefined) continue;

    const minutes = workedMs(entry, now) / 60_000;

    const key = keyOf(entry);
    const row = byKey.get(key) ?? days.map(() => 0);
    row[index] = (row[index] ?? 0) + minutes;
    byKey.set(key, row);
    dayTotals[index] = (dayTotals[index] ?? 0) + minutes;
    total += minutes;
  }

  return { byKey, dayTotals, total };
}

/**
 * The week a `?w=` parameter asks for, as its Monday. Any valid day snaps to
 * its week; anything else (or nothing) means the current week.
 */
export function resolveWeek(param: string | string[] | undefined, timeZone: string, now: Date): string {
  if (typeof param === "string" && isIsoDate(param)) {
    return zonedWeekStart(zonedInstant(param, 12 * 60, timeZone), timeZone);
  }
  return zonedWeekStart(now, timeZone);
}
