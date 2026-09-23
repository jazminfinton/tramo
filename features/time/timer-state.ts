/**
 * What the clock shows, from what the database holds: the running block (an
 * entry without an end) and the person's TimerSession (the task across
 * pauses). Pure, so the page, the floating window and the tests agree.
 */

type Named = { project: { name: string; color: string } };
type RunningBlock = Named & { projectId: string; description: string; startedAt: Date };
type Session = Named & { projectId: string; description: string; doneSeconds: number };

export type TimerState = {
  state: "running" | "paused";
  projectId: string;
  description: string;
  /** While running: when the current block started (ISO). */
  startedAt: string | null;
  /** Seconds the task's closed blocks already added up. */
  doneSeconds: number;
  projectName: string;
  projectColor: string;
};

export function timerState(running: RunningBlock | null, session: Session | null): TimerState | null {
  if (running) {
    // The session counts only if it's the same task: a block started from
    // somewhere else (before sessions existed) runs from zero.
    const same = session?.projectId === running.projectId && session.description === running.description;
    return {
      state: "running",
      projectId: running.projectId,
      description: running.description,
      startedAt: running.startedAt.toISOString(),
      doneSeconds: same ? session.doneSeconds : 0,
      projectName: running.project.name,
      projectColor: running.project.color,
    };
  }
  if (session) {
    return {
      state: "paused",
      projectId: session.projectId,
      description: session.description,
      startedAt: null,
      doneSeconds: session.doneSeconds,
      projectName: session.project.name,
      projectColor: session.project.color,
    };
  }
  return null;
}

/** The task's time at `now`: what it already did, plus the running block. */
export function elapsedMs(timer: TimerState | null, now: number): number {
  if (!timer) return 0;
  const running = timer.startedAt ? Math.max(0, now - new Date(timer.startedAt).getTime()) : 0;
  return timer.doneSeconds * 1000 + running;
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
