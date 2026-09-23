import "server-only";

import { prisma } from "@/lib/db";

/** Everyone in the workspace, in the order they joined. */
export function listMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

/** Invitations nobody has used yet, newest first, with the projects picked for each. */
export function listOpenInvitations(workspaceId: string) {
  return prisma.invitation.findMany({
    where: { workspaceId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      projects: {
        orderBy: { project: { name: "asc" } },
        select: { role: true, project: { select: { id: true, name: true, color: true } } },
      },
    },
  });
}

/** Projects an invitation can include: the active ones, by name. */
export function listInvitableProjects(workspaceId: string) {
  return prisma.project.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
}
