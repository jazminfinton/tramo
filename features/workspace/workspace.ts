import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

export type WorkspaceResult = { ok: true } | { ok: false; reason: "notFound" };

/** Renames a workspace. Callers are its admins (checked by the DAL). */
export async function renameWorkspace(db: PrismaClient, workspaceId: string, name: string): Promise<WorkspaceResult> {
  const { count } = await db.workspace.updateMany({ where: { id: workspaceId }, data: { name } });
  return count === 1 ? { ok: true } : { ok: false, reason: "notFound" };
}
