/**
 * What the clock shows, from what the database holds: the person's open entry,
 * the task being timed, running or paused. Pure, so the page, the floating
 * window and the tests agree.
 */

type OpenEntry = {
  projectId: string;
  description: string;
  startedAt: Date;
  pausedAt: Date | null;
  pausedSeconds: number;
  project: { name: string; color: string };
};

export type TimerState = {
  state: "running" | "paused";
  projectId: string;
  description: string;
  /** When the task started (ISO). */
  startedAt: string;
  /** While paused: when the pause began (ISO). */
  pausedAt: string | null;
  /** Seconds the task has spent paused, the pause in course aside. */
  pausedSeconds: number;
  projectName: string;
  projectColor: string;
};

export function timerState(open: OpenEntry | null): TimerState | null {
  if (!open) return null;
  return {
    state: open.pausedAt ? "paused" : "running",
    projectId: open.projectId,
    description: open.description,
    startedAt: open.startedAt.toISOString(),
    pausedAt: open.pausedAt?.toISOString() ?? null,
    pausedSeconds: open.pausedSeconds,
    projectName: open.project.name,
    projectColor: open.project.color,
  };
}

/** The task's time worked at `now`: since play, minus its pauses. It stands still while paused. */
export function elapsedMs(timer: TimerState | null, now: number): number {
  if (!timer) return 0;
  const end = timer.pausedAt ? new Date(timer.pausedAt).getTime() : now;
  return Math.max(0, end - new Date(timer.startedAt).getTime() - timer.pausedSeconds * 1000);
}

/** A duration as the clock's three blocks: hours (two digits or more), minutes, seconds. */
export function clockParts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const two = (value: number) => String(value).padStart(2, "0");
  return {
    hours: two(Math.floor(total / 3600)),
    minutes: two(Math.floor((total % 3600) / 60)),
    seconds: two(total % 60),
  };
}
