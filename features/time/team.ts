import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { visibleProjectsWhere } from "@/lib/access/permissions";

/**
 * Every block in the projects this viewer can see, whoever logged it, that
 * started in [start, end): the team's detailed week. Visibility is the usual
 * transparency per project, so a block stays part of its project even after
 * the person who logged it left.
 */
export function listTeamEntries(
  db: PrismaClient,
  input: { workspaceId: string; userId: string; isAdmin: boolean; start: Date; end: Date },
) {
  return db.timeEntry.findMany({
    where: {
      project: visibleProjectsWhere(input),
      startedAt: { gte: input.start, lt: input.end },
    },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      projectId: true,
      description: true,
      startedAt: true,
      endedAt: true,
      source: true,
      editedAt: true,
      project: { select: { name: true, color: true } },
      user: { select: { id: true, name: true } },
    },
  });
}

export type TeamEntry = Awaited<ReturnType<typeof listTeamEntries>>[number];
