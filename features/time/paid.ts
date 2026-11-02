import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { shiftIsoDate, zonedInstant } from "@/lib/zoned";

/**
 * Marking hours as paid (owner's decision, see openspec/.../discovery.md):
 * - People mark their own hours, a whole day or a single block. Nobody marks
 *   somebody else's, not even an admin.
 * - The mark lives on each block, as the moment it was made. So a day is paid,
 *   partly paid or unpaid according to its blocks, and a block added later to a
 *   paid day comes in unpaid.
 * - Only a finished block can carry it: an open one still has hours to come.
 * - Marking isn't editing: a marked block isn't flagged as edited.
 */

export type PaidResult = { ok: true } | { ok: false; reason: "notFound" | "forbidden" | "running" };

export async function setEntryPaid(
  db: PrismaClient,
  input: { userId: string; workspaceId: string; entryId: string; paid: boolean; now: Date },
): Promise<PaidResult> {
  const entry = await db.timeEntry.findFirst({
    where: { id: input.entryId, project: { workspaceId: input.workspaceId } },
    select: { id: true, userId: true, endedAt: true, paidAt: true },
  });
  if (!entry) return { ok: false, reason: "notFound" };
  if (entry.userId !== input.userId) return { ok: false, reason: "forbidden" };
  if (entry.endedAt === null) return { ok: false, reason: "running" };

  // Already marked (a double click): it keeps the date it was first marked on.
  if (input.paid && entry.paidAt) return { ok: true };

  await db.timeEntry.update({ where: { id: entry.id }, data: { paidAt: input.paid ? input.now : null } });
  return { ok: true };
}

/**
 * Marks a person's finished blocks of one day, on their own clock: a block
 * belongs to the day it started, like everywhere else. An open block stays out,
 * and a block already marked keeps its date.
 */
export async function setDayPaid(
  db: PrismaClient,
  input: { userId: string; workspaceId: string; day: string; timeZone: string; paid: boolean; now: Date },
): Promise<PaidResult> {
  await db.timeEntry.updateMany({
    where: {
      userId: input.userId,
      project: { workspaceId: input.workspaceId },
      startedAt: {
        gte: zonedInstant(input.day, 0, input.timeZone),
        lt: zonedInstant(shiftIsoDate(input.day, 1), 0, input.timeZone),
      },
      endedAt: { not: null },
      paidAt: input.paid ? null : { not: null },
    },
    data: { paidAt: input.paid ? input.now : null },
  });
  return { ok: true };
}
