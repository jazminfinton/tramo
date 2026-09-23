import "server-only";

import { minutesByPeriod, minutesByPerson, minutesByProject, topTasks } from "@/features/metrics/aggregate";
import { resolveRange } from "@/features/metrics/range";
import { visibleProjectsWhere } from "@/lib/access/permissions";
import { prisma } from "@/lib/db";

/** Past this many projects, the rest fold into "Other": the palette has eight slots, never a ninth. */
const MAX_SERIES = 7;

/**
 * Transparency per project: admins see every project of the workspace;
 * everyone else sees the projects they belong to (as tracker or viewer), with
 * everyone's hours in them.
 */
function visibleProjects(userId: string, workspaceId: string, isAdmin: boolean) {
  return prisma.project.findMany({
    where: visibleProjectsWhere({ workspaceId, userId, isAdmin }),
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: { id: true, name: true, color: true, archivedAt: true },
  });
}

export async function getMetrics(input: {
  userId: string;
  workspaceId: string;
  isAdmin: boolean;
  timeZone: string;
  rangeParam: string | string[] | undefined;
  projectParam: string | string[] | undefined;
}) {
  const now = new Date();
  const range = resolveRange(input.rangeParam, input.timeZone, now);
  const projects = await visibleProjects(input.userId, input.workspaceId, input.isAdmin);
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const selected =
    typeof input.projectParam === "string" && projectById.has(input.projectParam) ? input.projectParam : null;
  const scope = { projectIds: selected ? [selected] : [...projectById.keys()], start: range.start, end: range.end, now };

  const [byPerson, byProjectRows, tasks, periodRows] = await Promise.all([
    minutesByPerson(prisma, scope),
    minutesByProject(prisma, scope),
    topTasks(prisma, scope, 10),
    minutesByPeriod(prisma, { ...scope, timeZone: input.timeZone, unit: range.unit }),
  ]);

  const byProject = byProjectRows.flatMap((row) => {
    const project = projectById.get(row.projectId);
    return project ? [{ id: project.id, name: project.name, color: project.color, minutes: row.minutes }] : [];
  });

  // Series per day or week: the top projects keep their own color, the tail folds into one.
  const main = byProject.slice(0, MAX_SERIES);
  const mainIds = new Set(main.map((project) => project.id));
  const bucketIndex = new Map(range.buckets.map((bucket, index) => [bucket, index]));
  type Series = { key: string; name: string | null; color: string | null; values: number[] };
  const series: Series[] = main.map((project) => ({
    key: project.id,
    name: project.name,
    color: project.color,
    values: range.buckets.map(() => 0),
  }));
  // name null = "Other", labeled by the client in the viewer's language.
  const other: Series = { key: "other", name: null, color: null, values: range.buckets.map(() => 0) };

  for (const row of periodRows) {
    const index = bucketIndex.get(row.bucket);
    if (index === undefined) continue;
    const target = mainIds.has(row.projectId) ? series.find((item) => item.key === row.projectId) : other;
    if (target) target.values[index] = (target.values[index] ?? 0) + row.minutes;
  }
  if (other.values.some((value) => value > 0)) series.push(other);

  return {
    range,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      color: project.color,
      archived: project.archivedAt !== null,
    })),
    selected,
    total: byProject.reduce((sum, project) => sum + project.minutes, 0),
    byPerson,
    byProject,
    tasks: tasks.flatMap((task) => {
      const project = projectById.get(task.projectId);
      return project ? [{ ...task, projectName: project.name, projectColor: project.color }] : [];
    }),
    series,
  };
}

export type Metrics = Awaited<ReturnType<typeof getMetrics>>;
