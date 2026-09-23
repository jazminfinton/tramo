/**
 * The choices of the start and end selectors of a manual block, in minutes of
 * the day. A quarter-hour grid, like a calendar's; a time off the grid (a block
 * the timer recorded, being edited) is kept, so it can stay exactly as it is.
 */

export const STEP = 15;
const DAY = 24 * 60;

export function toClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Every quarter hour of the day, plus `extra` in its place when it's off the grid. */
export function startOptions(extra?: number | null): number[] {
  const grid = Array.from({ length: DAY / STEP }, (_, index) => index * STEP);
  if (extra == null || grid.includes(extra)) return grid;
  return [...grid, extra].sort((a, b) => a - b);
}

export type EndOption = { minutes: number; duration: number; nextDay: boolean };

/**
 * Where a block that starts at `start` can end: from a quarter later up to
 * 23 h 45 min later, crossing midnight into the next day, each choice with
 * its duration. Durations step from the start, so a start off the grid keeps
 * round durations. `extra` (the end being edited) keeps its place.
 */
export function endOptions(start: number, extra?: number | null): EndOption[] {
  const durations = Array.from({ length: DAY / STEP - 1 }, (_, index) => (index + 1) * STEP);
  if (extra != null) {
    const duration = (extra - start + DAY) % DAY;
    if (duration > 0 && !durations.includes(duration)) {
      durations.push(duration);
      durations.sort((a, b) => a - b);
    }
  }
  return durations.map((duration) => ({
    minutes: (start + duration) % DAY,
    duration,
    nextDay: start + duration >= DAY,
  }));
}

/** What someone may type to jump to a time: "9:30" or "930" for 09:30, "18" for 18:00. */
export function timeKeywords(minutes: number): string[] {
  const hours = Math.floor(minutes / 60);
  const mm = String(minutes % 60).padStart(2, "0");
  const keywords: string[] = [];

  if (hours < 10) keywords.push(`${hours}:${mm}`);
  keywords.push(`${String(hours).padStart(2, "0")}${mm}`);
  // "930" for 09:30, but no "130" for 01:30: it would steal "13" from 13:00.
  if (hours >= 3 && hours <= 9) keywords.push(`${hours}${mm}`);
  if (mm === "00") keywords.push(`${hours}`);
  return keywords;
}

/** What a new block proposes: the last hour before now, on the quarter grid. */
export function defaultBlock(nowMinutes: number) {
  const end = Math.floor(nowMinutes / STEP) * STEP;
  if (end < STEP) return { start: 0, end: 60 };
  return { start: Math.max(0, end - 60), end };
}
