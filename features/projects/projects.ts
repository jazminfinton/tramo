import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { ProjectRole } from "@/generated/prisma/enums";
import { nextProjectColor, type ProjectColor } from "@/lib/project-colors";

/**
 * Project operations, used by the admin Server Actions. Callers are admins of
 * `workspaceId` (checked by the DAL); every query is still scoped to it, so an
 * id from another workspace is "not found".
 */

export type ProjectResult =
  | { ok: true }
  | { ok: false; reason: "notFound" | "nameTaken" | "notMember" };

const ok: ProjectResult = { ok: true };
const fail = (reason: Extract<ProjectResult, { ok: false }>["reason"]): ProjectResult => ({
  ok: false,
  reason,
});

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** Creates a project with the next free color; its creator becomes a tracker. */
export async function createProject(
  db: PrismaClient,
  input: { workspaceId: string; creatorId: string; name: string },
): Promise<ProjectResult> {
  const used = await db.project.findMany({
    where: { workspaceId: input.workspaceId, archivedAt: null },
    select: { color: true },
  });

  try {
    await db.project.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        color: nextProjectColor(used.map((project) => project.color)),
        members: { create: { userId: input.creatorId, role: "TRACKER" } },
      },
    });
    return ok;
  } catch (error) {
    if (isUniqueViolation(error)) return fail("nameTaken");
    throw error;
  }
}

export async function updateProject(
  db: PrismaClient,
  workspaceId: string,
  projectId: string,
  data: { name: string; color: ProjectColor },
): Promise<ProjectResult> {
  try {
    const { count } = await db.project.updateMany({ where: { id: projectId, workspaceId }, data });
    return count === 1 ? ok : fail("notFound");
  } catch (error) {
    if (isUniqueViolation(error)) return fail("nameTaken");
    throw error;
  }
}

/** Archived projects keep their history; they just leave pickers and lists. */
export async function setProjectArchived(
  db: PrismaClient,
  workspaceId: string,
  projectId: string,
  archived: boolean,
): Promise<ProjectResult> {
  const { count } = await db.project.updateMany({
    where: { id: projectId, workspaceId },
    data: { archivedAt: archived ? new Date() : null },
  });
  return count === 1 ? ok : fail("notFound");
}

/** Adds someone to a project, or changes their role if they're already in it. */
export async function assignToProject(
  db: PrismaClient,
  workspaceId: string,
  projectId: string,
  userId: string,
  role: ProjectRole,
): Promise<ProjectResult> {
  const [project, member] = await Promise.all([
    db.project.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } }),
    db.workspaceMember.findFirst({ where: { workspaceId, userId, status: "ACTIVE" }, select: { id: true } }),
  ]);
  if (!project) return fail("notFound");
  if (!member) return fail("notMember");

  await db.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role },
    update: { role },
  });
  return ok;
}

export async function removeFromProject(
  db: PrismaClient,
  workspaceId: string,
  projectId: string,
  userId: string,
): Promise<ProjectResult> {
  const { count } = await db.projectMember.deleteMany({
    where: { projectId, userId, project: { workspaceId } },
  });
  return count === 1 ? ok : fail("notFound");
}
