import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";

/**
 * The timer's rules, against the database. The server is the source of truth:
 * a running timer is just an entry without `endedAt`, so closing the tab or
 * the floating window never stops or loses time, and any device sees it.
 *
 * Pausing closes the running entry; resuming starts a new entry with the same
 * project and description, so every row is one editable block. The person's
 * TimerSession remembers the task and the seconds its blocks added up, so the
 * clock resumes from there, until the task is finished.
 */

export type TimerResult = { ok: true } | { ok: false; reason: "cannotTrack" | "conflict" | "nothingPaused" };

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Closes whatever is running at `now`. A block that would end at or before its
 * own start (two clicks in the same millisecond) is dropped instead, since the
 * database refuses an entry that doesn't end after it starts.
 */
async function closeRunning(tx: Tx, userId: string, now: Date) {
  const current = await tx.timeEntry.findFirst({ where: { userId, endedAt: null } });
  if (!current) return null;

  if (now.getTime() > current.startedAt.getTime()) {
    await tx.timeEntry.update({ where: { id: current.id }, data: { endedAt: now } });
  } else {
    await tx.timeEntry.delete({ where: { id: current.id } });
  }
  return { ...current, seconds: Math.max(0, Math.floor((now.getTime() - current.startedAt.getTime()) / 1000)) };
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
      const current = await tx.timeEntry.findFirst({ where: { userId: input.userId, endedAt: null } });
      if (current && current.projectId === input.projectId && current.description === input.description) {
        return; // Already running exactly this: a double click, not a new block.
      }

      await closeRunning(tx, input.userId, input.now);
      await tx.timeEntry.create({
        data: {
          userId: input.userId,
          projectId: input.projectId,
          description: input.description,
          startedAt: input.now,
        },
      });
      // A new task: its clock starts from zero.
      const task = { projectId: input.projectId, description: input.description, doneSeconds: 0, pausedAt: null };
      await tx.timerSession.upsert({ where: { userId: input.userId }, create: { userId: input.userId, ...task }, update: task });
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
 * Pauses the task: the running block closes, and its seconds add up on the
 * session. Nothing running (a double click): nothing to do.
 */
export async function pauseTimer(db: PrismaClient, input: { userId: string; now: Date }): Promise<TimerResult> {
  await db.$transaction(async (tx) => {
    await lockPerson(tx, input.userId);
    const closed = await closeRunning(tx, input.userId, input.now);
    if (!closed) return;

    // A block started before sessions existed has none yet: it starts one.
    const session = await tx.timerSession.findUnique({ where: { userId: input.userId } });
    const sameTask = session?.projectId === closed.projectId && session.description === closed.description;
    const doneSeconds = (sameTask ? session.doneSeconds : 0) + closed.seconds;
    const task = { projectId: closed.projectId, description: closed.description, doneSeconds, pausedAt: input.now };
    await tx.timerSession.upsert({ where: { userId: input.userId }, create: { userId: input.userId, ...task }, update: task });
  });
  return { ok: true };
}

/** Resumes the paused task in a new block; its clock goes on from where it was. */
export async function resumeTimer(
  db: PrismaClient,
  input: { userId: string; workspaceId: string; now: Date },
): Promise<TimerResult> {
  try {
    return await db.$transaction(async (tx): Promise<TimerResult> => {
      await lockPerson(tx, input.userId);
      const session = await tx.timerSession.findUnique({ where: { userId: input.userId } });
      if (!session) return { ok: false, reason: "nothingPaused" };
      if (await tx.timeEntry.findFirst({ where: { userId: input.userId, endedAt: null }, select: { id: true } })) {
        return { ok: true }; // Already running: a double click.
      }
      if (!(await canTrackProject(tx, { ...input, projectId: session.projectId }))) {
        return { ok: false, reason: "cannotTrack" };
      }

      await tx.timeEntry.create({
        data: { userId: input.userId, projectId: session.projectId, description: session.description, startedAt: input.now },
      });
      await tx.timerSession.update({ where: { userId: input.userId }, data: { pausedAt: null } });
      return { ok: true };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "conflict" };
    }
    throw error;
  }
}

/** Finishes the task: the running block (if any) closes and the clock goes back to zero. */
export async function finishTimer(db: PrismaClient, input: { userId: string; now: Date }): Promise<TimerResult> {
  await db.$transaction(async (tx) => {
    await lockPerson(tx, input.userId);
    await closeRunning(tx, input.userId, input.now);
    await tx.timerSession.deleteMany({ where: { userId: input.userId } });
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
