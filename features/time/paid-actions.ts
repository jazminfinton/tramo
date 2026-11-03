"use server";

import { refresh } from "next/cache";

import {
  paidDays,
  paidRangePreview,
  payablePeople,
  setDayPaid,
  setEntryPaid,
  setRangePaid,
  type PaidDay,
  type PaidRangePreview,
  type PaidResult,
} from "@/features/time/paid";
import { paidDaySchema, paidEntrySchema, paidRangeSchema, setPaidRangeSchema } from "@/features/time/schema";
import { DEFAULT_TIME_ZONE } from "@/i18n/config";
import { requireMember } from "@/lib/dal";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/form";

// Whose hours these are comes from the session, never from the client: only an
// admin's range reaches somebody else's hours, and that's decided here too. The
// person a range asks for only counts for an admin. Days are read in the person's
// own time zone, and the moment of the mark is the server's.

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

/** What marking a range would touch. It writes nothing, so the page stays as it is. */
export async function previewPaidRangeAction(
  from: string,
  to: string,
  projectId: string | null,
  personId: string | null,
): Promise<{ preview: PaidRangePreview } | { error: string }> {
  const { user, workspace, isAdmin } = await requireMember();
  const parsed = paidRangeSchema.safeParse({ from, to, projectId, personId });
  if (!parsed.success) return { error: "invalid" };

  return {
    preview: await paidRangePreview(prisma, {
      actor: { userId: user.id, isAdmin },
      workspaceId: workspace.id,
      timeZone: user.timeZone ?? DEFAULT_TIME_ZONE,
      ...parsed.data,
    }),
  };
}

/** How much is paid on each day of a range, for the calendar to mark. It writes nothing either. */
export async function paidDaysAction(
  from: string,
  to: string,
  projectId: string | null,
  personId: string | null,
): Promise<{ days: PaidDay[] } | { error: string }> {
  const { user, workspace, isAdmin } = await requireMember();
  const parsed = paidRangeSchema.safeParse({ from, to, projectId, personId });
  if (!parsed.success) return { error: "invalid" };

  return {
    days: await paidDays(prisma, {
      actor: { userId: user.id, isAdmin },
      workspaceId: workspace.id,
      timeZone: user.timeZone ?? DEFAULT_TIME_ZONE,
      ...parsed.data,
    }),
  };
}

/** Whose hours an admin can mark. Nobody else chooses, so nobody else gets the names. */
export async function payablePeopleAction(): Promise<{ people: { id: string; name: string }[] } | { error: string }> {
  const { workspace, isAdmin } = await requireMember();
  if (!isAdmin) return { error: "forbidden" };

  return { people: await payablePeople(prisma, workspace.id) };
}

export async function setPaidRangeAction(
  from: string,
  to: string,
  projectId: string | null,
  personId: string | null,
  paid: boolean,
): Promise<{ count: number } | { error: string }> {
  const { user, workspace, isAdmin } = await requireMember();
  const parsed = setPaidRangeSchema.safeParse({ from, to, projectId, personId, paid });
  if (!parsed.success) return { error: "invalid" };

  const result = await setRangePaid(prisma, {
    actor: { userId: user.id, isAdmin },
    workspaceId: workspace.id,
    timeZone: user.timeZone ?? DEFAULT_TIME_ZONE,
    ...parsed.data,
    now: new Date(),
  });
  refresh();
  return result;
}
