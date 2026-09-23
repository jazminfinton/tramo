import "server-only";

import { prisma } from "@/lib/db";

/** Everything the admin board needs: projects with their people, and who can be assigned. */
export async function getProjectsBoard(workspaceId: string) {
  const [projects, members] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        archivedAt: true,
        members: {
          orderBy: { createdAt: "asc" },
          select: { userId: true, role: true, user: { select: { name: true } } },
        },
      },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  return {
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      color: project.color,
      archived: project.archivedAt !== null,
      members: project.members.map((member) => ({
        userId: member.userId,
        name: member.user.name,
        role: member.role,
      })),
    })),
    people: members.map((member) => member.user),
  };
}

export type BoardProject = Awaited<ReturnType<typeof getProjectsBoard>>["projects"][number];
export type BoardPerson = Awaited<ReturnType<typeof getProjectsBoard>>["people"][number];
