import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { taskInWorkspace } from "@/features/time/tasks";

/**
 * Manual blocks: adding time after the fact, fixing it, deleting it.
 *
 * Rules (owner's decisions, see openspec/.../discovery.md):
 * - People edit their own blocks anytime; admins edit anyone's.
 * - Every manual creation or edit is flagged (source MANUAL / editedAt), so
 *   the metrics stay honest.
 * - A person can't have two blocks at the same time, a running timer
 *   included: overlapping blocks would count the same hour twice.
 * - A running block belongs to the timer and isn't edited here.
 * - A block keeps the pauses its timer measured: editing its times changes
 *   its span, never its paused time, so the span has to leave time worked.
 * - A block can sit under one of its workspace's shared tasks, next to its
 *   free-text description. Any block can be moved onto one, or off it, later.
 */

export type EntryResult =
  | { ok: true }
  | {
      ok: false;
      reason: "notFound" | "forbidden" | "cannotTrack" | "unknownTask" | "overlap" | "running" | "pausesTooLong";
    };

type Actor = { userId: string; isAdmin: boolean };
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const ok: EntryResult = { ok: true };
const fail = (reason: Extract<EntryResult, { ok: false }>["reason"]): EntryResult => ({ ok: false, reason });

// Writes for one person run one at a time, so two tabs can't sneak two
// overlapping blocks past the check at the same moment.
async function lockPerson(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(2, hashtext(${userId}))`;
}

async function overlaps(tx: Tx, userId: string, startedAt: Date, endedAt: Date, excludeId?: string) {
  const clash = await tx.timeEntry.findFirst({
    where: {
      userId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startedAt: { lt: endedAt },
      OR: [{ endedAt: { gt: startedAt } }, { endedAt: null }],
    },
    select: { id: true },
  });
  return clash !== null;
}

async function tracks(tx: Tx, userId: string, projectId: string, workspaceId: string) {
  const membership = await tx.projectMember.findFirst({
    where: { userId, projectId, role: "TRACKER", project: { workspaceId, archivedAt: null } },
    select: { projectId: true },
  });
  return membership !== null;
}

export async function createManualEntry(
  db: PrismaClient,
  input: {
    actor: Actor;
    workspaceId: string;
    projectId: string;
    description: string;
    /** The shared task the block belongs to, if any. */
    taskId?: string | null;
    startedAt: Date;
    endedAt: Date;
  },
): Promise<EntryResult> {
  const taskId = input.taskId ?? null;
  return db.$transaction(async (tx) => {
    if (!(await tracks(tx, input.actor.userId, input.projectId, input.workspaceId))) return fail("cannotTrack");
    if (!(await taskInWorkspace(tx, taskId, input.workspaceId))) return fail("unknownTask");

    await lockPerson(tx, input.actor.userId);
    if (await overlaps(tx, input.actor.userId, input.startedAt, input.endedAt)) return fail("overlap");

    await tx.timeEntry.create({
      data: {
        userId: input.actor.userId,
        projectId: input.projectId,
        taskId,
        description: input.description,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        source: "MANUAL",
      },
    });
    return ok;
  });
}

export async function updateEntry(
  db: PrismaClient,
  input: {
    actor: Actor;
    workspaceId: string;
    entryId: string;
    projectId: string;
    description: string;
    /** The shared task to move the block to, or null to take it off one. Left out: the block keeps its own. */
    taskId?: string | null;
    startedAt: Date;
    endedAt: Date;
    /**
     * The person didn't touch the times (see showsSameTimes): the block keeps
     * its own instants, and `startedAt` / `endedAt` above are ignored.
     */
    keepTimes?: boolean;
  },
): Promise<EntryResult> {
  return db.$transaction(async (tx) => {
    const entry = await tx.timeEntry.findFirst({
      where: { id: input.entryId, project: { workspaceId: input.workspaceId } },
      select: { id: true, userId: true, endedAt: true, pausedSeconds: true },
    });
    if (!entry) return fail("notFound");
    if (entry.userId !== input.actor.userId && !input.actor.isAdmin) return fail("forbidden");
    if (entry.endedAt === null) return fail("running");
    // The block stays its owner's: the owner has to be able to track the target project.
    if (!(await tracks(tx, entry.userId, input.projectId, input.workspaceId))) return fail("cannotTrack");
    if (!(await taskInWorkspace(tx, input.taskId ?? null, input.workspaceId))) return fail("unknownTask");

    const what = {
      projectId: input.projectId,
      taskId: input.taskId, // left out: the block keeps its own
      description: input.description,
      editedAt: new Date(),
    };
    if (input.keepTimes) {
      await tx.timeEntry.update({ where: { id: entry.id }, data: what });
      return ok;
    }

    // The pauses stay: the new span has to leave time worked once they're out.
    const span = input.endedAt.getTime() - input.startedAt.getTime();
    if (span <= entry.pausedSeconds * 1000) return fail("pausesTooLong");

    await lockPerson(tx, entry.userId);
    if (await overlaps(tx, entry.userId, input.startedAt, input.endedAt, entry.id)) return fail("overlap");

    await tx.timeEntry.update({
      where: { id: entry.id },
      data: { ...what, startedAt: input.startedAt, endedAt: input.endedAt },
    });
    return ok;
  });
}

export async function deleteEntry(
  db: PrismaClient,
  input: { actor: Actor; workspaceId: string; entryId: string },
): Promise<EntryResult> {
  const entry = await db.timeEntry.findFirst({
    where: { id: input.entryId, project: { workspaceId: input.workspaceId } },
    select: { id: true, userId: true },
  });
  if (!entry) return fail("notFound");
  if (entry.userId !== input.actor.userId && !input.actor.isAdmin) return fail("forbidden");

  await db.timeEntry.delete({ where: { id: entry.id } });
  return ok;
}
