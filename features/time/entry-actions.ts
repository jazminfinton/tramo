"use server";

import { refresh } from "next/cache";

import { createManualEntry, deleteEntry, updateEntry, type EntryResult } from "@/features/time/entries";
import { buildInterval } from "@/features/time/interval";
import { entryFormSchema, entryFromForm } from "@/features/time/schema";
import { DEFAULT_TIME_ZONE } from "@/i18n/config";
import { requireMember } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { parse, type ActionResult } from "@/lib/form";

// Times are interpreted on the server's clock and in the person's own time
// zone (from the session), never in the server's zone.

type Parsed = { ok: true; data: { projectId: string; description: string; startedAt: Date; endedAt: Date } };

async function readForm(formData: FormData, timeZone: string): Promise<Parsed | { ok: false; result: ActionResult }> {
  const parsed = parse(entryFormSchema, entryFromForm(formData));
  if (!parsed.ok) return parsed;

  const interval = buildInterval({ ...parsed.data, timeZone, now: new Date() });
  if (!interval.ok) return { ok: false, result: { fieldErrors: interval.errors } };

  return {
    ok: true,
    data: {
      projectId: parsed.data.projectId,
      description: parsed.data.description,
      startedAt: interval.startedAt,
      endedAt: interval.endedAt,
    },
  };
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
  const form = await readForm(formData, user.timeZone ?? DEFAULT_TIME_ZONE);
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
