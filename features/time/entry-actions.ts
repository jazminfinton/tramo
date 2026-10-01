"use server";

import { refresh } from "next/cache";

import { createManualEntry, deleteEntry, updateEntry, type EntryResult } from "@/features/time/entries";
import { buildInterval, showsSameTimes } from "@/features/time/interval";
import { entryFormSchema, entryFromForm } from "@/features/time/schema";
import { DEFAULT_TIME_ZONE } from "@/i18n/config";
import { requireMember } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { parse, type ActionResult } from "@/lib/form";

// Times are interpreted on the server's clock and in the person's own time
// zone (from the session), never in the server's zone.

type Times = { startedAt: Date; endedAt: Date };
type Parsed = { ok: true; data: Times & { projectId: string; description: string; keepTimes: boolean } };

/**
 * Reads the form. `stored` is the block being edited: when the form still
 * shows its own day and times, the person didn't touch them, so they stay
 * exactly as they are instead of being rebuilt from the form.
 */
async function readForm(
  formData: FormData,
  timeZone: string,
  stored?: Times | null,
): Promise<Parsed | { ok: false; result: ActionResult }> {
  const parsed = parse(entryFormSchema, entryFromForm(formData));
  if (!parsed.ok) return parsed;
  const what = { projectId: parsed.data.projectId, description: parsed.data.description };

  if (stored && showsSameTimes(stored, parsed.data, timeZone)) {
    return { ok: true, data: { ...what, ...stored, keepTimes: true } };
  }

  const interval = buildInterval({ ...parsed.data, timeZone, now: new Date() });
  if (!interval.ok) return { ok: false, result: { fieldErrors: interval.errors } };

  return { ok: true, data: { ...what, startedAt: interval.startedAt, endedAt: interval.endedAt, keepTimes: false } };
}

function settle(result: EntryResult): ActionResult {
  if (!result.ok) return { error: result.reason };
  refresh();
  return { ok: true };
}

export async function createEntryAction(formData: FormData): Promise<ActionResult> {
  const { user, workspace, isAdmin } = await requireMember();
  const form = await readForm(formData, user.timeZone ?? DEFAULT_TIME_ZONE);
  if (!form.ok) return form.result;

  return settle(
    await createManualEntry(prisma, { actor: { userId: user.id, isAdmin }, workspaceId: workspace.id, ...form.data }),
  );
}

export async function updateEntryAction(entryId: string, formData: FormData): Promise<ActionResult> {
  const { user, workspace, isAdmin } = await requireMember();
  // Only its times are read here, to tell whether the form changed them;
  // updateEntry checks who may edit the block.
  const stored = await prisma.timeEntry.findFirst({
    where: { id: String(entryId), project: { workspaceId: workspace.id } },
    select: { startedAt: true, endedAt: true },
  });
  const form = await readForm(
    formData,
    user.timeZone ?? DEFAULT_TIME_ZONE,
    stored?.endedAt ? { startedAt: stored.startedAt, endedAt: stored.endedAt } : null,
  );
  if (!form.ok) return form.result;

  return settle(
    await updateEntry(prisma, {
      actor: { userId: user.id, isAdmin },
      workspaceId: workspace.id,
      entryId: String(entryId),
      ...form.data,
    }),
  );
}

export async function deleteEntryAction(entryId: string): Promise<ActionResult> {
  const { user, workspace, isAdmin } = await requireMember();
  return settle(
    await deleteEntry(prisma, { actor: { userId: user.id, isAdmin }, workspaceId: workspace.id, entryId: String(entryId) }),
  );
}
