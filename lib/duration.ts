/** A timer running this long gets the "did you forget it?" prompt (owner's decision: 8 h). */
export const FORGOTTEN_AFTER_MS = 8 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * A running clock: hh:mm:ss, hours unbounded ("100:00:00"). Negative input
 * (a client clock slightly behind the server's) shows as zero.
 */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** A total of minutes as h:mm ("2:30", "61:00"): how hour totals are read. */
export function formatHours(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

export function isForgotten(startedAt: Date, now: Date, thresholdMs = FORGOTTEN_AFTER_MS): boolean {
  return now.getTime() - startedAt.getTime() >= thresholdMs;
}
