"use server";

import { refresh } from "next/cache";

import { setDayPaid, setEntryPaid, type PaidResult } from "@/features/time/paid";
import { paidDaySchema, paidEntrySchema } from "@/features/time/schema";
import { DEFAULT_TIME_ZONE } from "@/i18n/config";
import { requireMember } from "@/lib/dal";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/form";

// Whose hours these are comes from the session, never from the client: nobody
// can mark somebody else's hours through these actions. Days are read in the
// person's own time zone, and the moment of the mark is the server's.

function settle(result: PaidResult): ActionResult {
  if (!result.ok) return { error: result.reason };
  refresh();
  return { ok: true };
}

export async function setEntryPaidAction(entryId: string, paid: boolean): Promise<ActionResult> {
  const { user, workspace } = await requireMember();
  const parsed = paidEntrySchema.safeParse({ entryId, paid });
  if (!parsed.success) return { error: "invalid" };

  return settle(
    await setEntryPaid(prisma, { userId: user.id, workspaceId: workspace.id, ...parsed.data, now: new Date() }),
  );
}

export async function setDayPaidAction(day: string, paid: boolean): Promise<ActionResult> {
  const { user, workspace } = await requireMember();
  const parsed = paidDaySchema.safeParse({ day, paid });
  if (!parsed.success) return { error: "invalid" };

  return settle(
    await setDayPaid(prisma, {
      userId: user.id,
      workspaceId: workspace.id,
      timeZone: user.timeZone ?? DEFAULT_TIME_ZONE,
      ...parsed.data,
      now: new Date(),
    }),
  );
}
