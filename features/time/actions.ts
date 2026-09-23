"use server";

import { refresh } from "next/cache";

import { startTimerSchema } from "@/features/time/schema";
import { finishTimer, pauseTimer, resumeTimer, startTimer } from "@/features/time/timer";
import { requireMember } from "@/lib/dal";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/form";

// The clock that counts is the server's (`new Date()` here), never a time the
// client sends: nobody can backdate a timer through these actions.

export async function startTimerAction(projectId: string, description: string): Promise<ActionResult> {
  const { user, workspace } = await requireMember();
  const parsed = startTimerSchema.safeParse({ projectId, description });
  if (!parsed.success) return { error: "invalid" };

  const result = await startTimer(prisma, {
    userId: user.id,
    workspaceId: workspace.id,
    projectId: parsed.data.projectId,
    description: parsed.data.description,
    now: new Date(),
  });

  refresh();
  return result.ok ? { ok: true } : { error: result.reason };
}

export async function pauseTimerAction(): Promise<ActionResult> {
  const { user } = await requireMember();
  await pauseTimer(prisma, { userId: user.id, now: new Date() });
  refresh();
  return { ok: true };
}

export async function resumeTimerAction(): Promise<ActionResult> {
  const { user, workspace } = await requireMember();
  const result = await resumeTimer(prisma, { userId: user.id, workspaceId: workspace.id, now: new Date() });
  refresh();
  return result.ok ? { ok: true } : { error: result.reason };
}

export async function finishTimerAction(): Promise<ActionResult> {
  const { user } = await requireMember();
  await finishTimer(prisma, { userId: user.id, now: new Date() });
  refresh();
  return { ok: true };
}
