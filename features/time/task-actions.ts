"use server";

import { refresh } from "next/cache";

import { taskNameSchema } from "@/features/time/schema";
import { createTask, type SharedTask } from "@/features/time/tasks";
import { requireMember } from "@/lib/dal";
import { prisma } from "@/lib/db";

// `error` is a key into messages/<locale>.json → tasks.errors.
export type CreateTaskActionResult = { task: SharedTask } | { error: string };

/**
 * Adds a task to the workspace's shared list and hands it back, so the form
 * that asked can pick it right away. A name that's already there hands back
 * the task that has it.
 */
export async function createTaskAction(name: string): Promise<CreateTaskActionResult> {
  const { user, workspace, isAdmin } = await requireMember();
  const parsed = taskNameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "generic" };

  const result = await createTask(prisma, {
    actor: { userId: user.id, isAdmin },
    workspaceId: workspace.id,
    name: parsed.data,
  });
  if (!result.ok) return { error: result.reason };

  refresh();
  return { task: result.task };
}
