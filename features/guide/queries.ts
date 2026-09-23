import "server-only";

import { prisma } from "@/lib/db";

/**
 * Where the person left the tour. Read from the database, not the session:
 * the session's cookie cache could still say "never seen" for five minutes
 * after they skipped it, and the tour would start again on a reload.
 */
export async function getTourStep(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tourStep: true } });
  return user?.tourStep ?? null;
}
