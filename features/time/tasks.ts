import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { taskNameKey, tidyTaskName } from "@/features/time/task-text";

/**
 * Shared tasks: a workspace's common list of things people work on, so the
 * whole team logs the same work under the same name.
 *
 * - Anyone who tracks time in the workspace can add one; so can admins.
 * - Names are unique per workspace, whatever their case: adding one that
 *   exists hands back the existing task instead of failing.
 * - A task is optional on an entry, next to its free-text description.
 */

type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export type SharedTask = { id: string; name: string };

export type CreateTaskResult = { ok: true; task: SharedTask } | { ok: false; reason: "cannotTrack" };

/** Whether this person logs time somewhere in the workspace: a tracker of a live project. */
async function tracksSomewhere(db: Db, userId: string, workspaceId: string) {
  const membership = await db.projectMember.findFirst({
    where: { userId, role: "TRACKER", project: { workspaceId, archivedAt: null } },
    select: { projectId: true },
  });
  return membership !== null;
}

export async function createTask(
  db: PrismaClient,
  input: { actor: { userId: string; isAdmin: boolean }; workspaceId: string; name: string },
): Promise<CreateTaskResult> {
  if (!input.actor.isAdmin && !(await tracksSomewhere(db, input.actor.userId, input.workspaceId))) {
    return { ok: false, reason: "cannotTrack" };
  }

  const name = tidyTaskName(input.name);
  const key = { workspaceId_nameKey: { workspaceId: input.workspaceId, nameKey: taskNameKey(name) } };
  const select = { id: true, name: true };

  const existing = await db.task.findUnique({ where: key, select });
  if (existing) return { ok: true, task: existing };

  try {
    const task = await db.task.create({
      data: { workspaceId: input.workspaceId, name, nameKey: taskNameKey(name), createdById: input.actor.userId },
      select,
    });
    return { ok: true, task };
  } catch (error) {
    // Two people added the same task at the same moment: the unique index let
    // one through, and the other gets that same task.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: true, task: await db.task.findUniqueOrThrow({ where: key, select }) };
    }
    throw error;
  }
}

/** The workspace's shared tasks, by name. */
export async function listTasks(db: Db, workspaceId: string): Promise<SharedTask[]> {
  const tasks = await db.task.findMany({ where: { workspaceId }, select: { id: true, name: true, nameKey: true } });
  return tasks
    .sort((a, b) => a.nameKey.localeCompare(b.nameKey, "es"))
    .map(({ id, name }) => ({ id, name }));
}

/** No task is fine; a task has to belong to this workspace. */
export async function taskInWorkspace(db: Db, taskId: string | null, workspaceId: string): Promise<boolean> {
  if (taskId === null) return true;
  const task = await db.task.findFirst({ where: { id: taskId, workspaceId }, select: { id: true } });
  return task !== null;
}
