/**
 * The time actually worked in an entry: its span, minus what it spent paused.
 *
 * An entry runs from play to stop and keeps a single row across pauses, so
 * its end minus its start is no longer its duration. Every total, list and
 * clock reads the duration from here (the metrics do the same sum in SQL, see
 * features/metrics/aggregate.ts).
 */

export type Timed = {
  startedAt: Date;
  /** Null while the entry is open: running, or paused. */
  endedAt: Date | null;
  /** While paused: when the pause began. */
  pausedAt?: Date | null;
  /** Seconds spent paused so far, the current pause aside. */
  pausedSeconds?: number;
};

/** An open entry counts up to `now`, or stands still at the moment it was paused. */
export function workedMs(entry: Timed, now: Date): number {
  const end = entry.endedAt ?? entry.pausedAt ?? now;
  return Math.max(0, end.getTime() - entry.startedAt.getTime() - (entry.pausedSeconds ?? 0) * 1000);
}
