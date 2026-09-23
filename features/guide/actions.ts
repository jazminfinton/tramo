"use server";

import { tourStepSchema } from "@/features/guide/schema";
import { getSession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/form";

/**
 * Remembers where the person is in the tour, on their account, so "Retomar"
 * works from any device. No refresh: the tour already shows the new step.
 *
 * Without a session it just doesn't save: a progress mark isn't worth
 * yanking someone to the sign-in page in the middle of the tour.
 */
export async function saveTourStepAction(step: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "unauthorized" };
  const parsed = tourStepSchema.safeParse(step);
  if (!parsed.success) return { error: "invalid" };

  await prisma.user.update({ where: { id: session.user.id }, data: { tourStep: parsed.data } });
  return { ok: true };
}
