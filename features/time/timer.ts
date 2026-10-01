import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";

/**
 * The timer's rules, against the database. The server is the source of truth:
 * a task being timed is just an entry without `endedAt`, so closing the tab or
 * the floating window never stops or loses time, and any device sees it.
 *
 * A task is one entry from play to stop. Pausing doesn't close it: the entry
 * stays open with `pausedAt` set, and resuming adds that pause to
 * `pausedSeconds`, so the time worked is the span minus the pauses
 * (features/time/worked.ts). Only stop, or starting a different task, ends it.
 */

export type TimerResult = { ok: true } | { ok: false; reason: "cannotTrack" | "conflict" | "nothingPaused" };

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** A person's open entry, running or paused. The database allows one at most. */
function openEntry(tx: Tx, userId: string) {
  return tx.timeEntry.findFirst({ where: { userId, endedAt: null } });
}

/**
 * Ends whatever is open: at `now` if it runs, at the moment it was paused
 * otherwise, since no work happened after that. An entry with no time worked
 * (two clicks in the same instant) is dropped instead: the database refuses
 * one that doesn't end after it starts.
 */
async function closeOpen(tx: Tx, userId: string, now: Date) {
  const current = await openEntry(tx, userId);
  if (!current) return;

  const end = current.pausedAt ?? now;
  const worked = end.getTime() - current.startedAt.getTime() - current.pausedSeconds * 1000;
  if (worked > 0) {
    await tx.timeEntry.update({ where: { id: current.id }, data: { endedAt: end, pausedAt: null } });
  } else {
    await tx.timeEntry.delete({ where: { id: current.id } });
  }
}

/** Takes an entry out of its pause: the pause's length joins its paused time. */
function unpause(tx: Tx, entry: { id: string; pausedAt: Date; pausedSeconds: number }, now: Date) {
  const paused = Math.max(0, Math.round((now.getTime() - entry.pausedAt.getTime()) / 1000));
  return tx.timeEntry.update({
    where: { id: entry.id },
    data: { pausedAt: null, pausedSeconds: entry.pausedSeconds + paused },
  });
}

// One timer change at a time per person: a double click, or two devices at
// once, can't interleave a pause with a resume.
async function lockPerson(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(2, hashtext(${userId}))`;
}

/** Only trackers of a live project in this workspace can log time on it. */
async function canTrackProject(db: PrismaClient | Tx, input: { userId: string; workspaceId: string; projectId: string }) {
  const membership = await db.projectMember.findFirst({
    where: {
      userId: input.userId,
      projectId: input.projectId,
      role: "TRACKER",
      project: { workspaceId: input.workspaceId, archivedAt: null },
    },
    select: { projectId: true },
  });
  return membership !== null;
}

export async function startTimer(
  db: PrismaClient,
  input: { userId: string; workspaceId: string; projectId: string; description: string; now: Date },
): Promise<TimerResult> {
  if (!(await canTrackProject(db, input))) return { ok: false, reason: "cannotTrack" };

  try {
    await db.$transaction(async (tx) => {
      await lockPerson(tx, input.userId);
      const current = await openEntry(tx, input.userId);
      if (current && current.projectId === input.projectId && current.description === input.description) {
        // The same task is already open. Running: a double click, nothing to
        // do. Paused: play goes on with it, in the same entry.
        if (current.pausedAt) await unpause(tx, { ...current, pausedAt: current.pausedAt }, input.now);
        return;
      }

      await closeOpen(tx, input.userId, input.now);
      await tx.timeEntry.create({
        data: {
          userId: input.userId,
          projectId: input.projectId,
          description: input.description,
          startedAt: input.now,
        },
      });
    });
    return { ok: true };
  } catch (error) {
    // Two devices started a timer at the same instant: the partial unique
    // index let only one through. The caller refreshes and shows the winner.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "conflict" };
    }
    throw error;
  }
}

/**
 * Pauses the task: its entry stays open and remembers when the pause began.
 * Nothing running, or already paused (a double click): nothing to do.
 */
export async function pauseTimer(db: PrismaClient, input: { userId: string; now: Date }): Promise<TimerResult> {
  await db.$transaction(async (tx) => {
    await lockPerson(tx, input.userId);
    const current = await openEntry(tx, input.userId);
    if (!current || current.pausedAt) return;

    // A pause can't begin before its entry (a clock that went backwards).
    const pausedAt = input.now.getTime() > current.startedAt.getTime() ? input.now : current.startedAt;
    await tx.timeEntry.update({ where: { id: current.id }, data: { pausedAt } });
  });
  return { ok: true };
}

/** Resumes the paused task: the same entry goes on, and the pause stays out of its time. */
export async function resumeTimer(
  db: PrismaClient,
  input: { userId: string; workspaceId: string; now: Date },
): Promise<TimerResult> {
  return db.$transaction(async (tx): Promise<TimerResult> => {
    await lockPerson(tx, input.userId);
    const current = await openEntry(tx, input.userId);
    if (!current) return { ok: false, reason: "nothingPaused" };
    if (!current.pausedAt) return { ok: true }; // Already running: a double click.
    if (!(await canTrackProject(tx, { ...input, projectId: current.projectId }))) {
      return { ok: false, reason: "cannotTrack" };
    }

    await unpause(tx, { ...current, pausedAt: current.pausedAt }, input.now);
    return { ok: true };
  });
}

/** Finishes the task: its entry ends, and the clock goes back to zero. */
export async function finishTimer(db: PrismaClient, input: { userId: string; now: Date }): Promise<TimerResult> {
  await db.$transaction(async (tx) => {
    await lockPerson(tx, input.userId);
    await closeOpen(tx, input.userId, input.now);
  });
  return { ok: true };
}

/**
 * The person's past task descriptions per project, most recently used first,
 * for the autocomplete. Loaded with the page and filtered on the client, so
 * typing costs no requests.
 */
export async function recentDescriptions(
  db: PrismaClient,
  userId: string,
  projectIds: string[],
  perProject = 30,
): Promise<Record<string, string[]>> {
  if (projectIds.length === 0) return {};

  const rows = await db.timeEntry.groupBy({
    by: ["projectId", "description"],
    where: { userId, projectId: { in: projectIds }, description: { not: "" } },
    _max: { startedAt: true },
    orderBy: { _max: { startedAt: "desc" } },
  });

  const byProject: Record<string, string[]> = {};
  for (const row of rows) {
    const list = (byProject[row.projectId] ??= []);
    if (list.length < perProject) list.push(row.description);
  }
  return byProject;
}
