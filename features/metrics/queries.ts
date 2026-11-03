import "server-only";

import { minutesByPeriod, minutesByPerson, minutesByProject, topTasks } from "@/features/metrics/aggregate";
import { resolveRange } from "@/features/metrics/range";
import { periodSeries } from "@/features/metrics/series";
import { visibleProjectsWhere } from "@/lib/access/permissions";
import { prisma } from "@/lib/db";
import { metricDefaults } from "@/lib/metric-views";

/**
 * Transparency per project: admins see every project of the workspace;
 * everyone else sees the projects they belong to (as tracker or viewer), with
 * everyone's hours in them.
 */
function visibleProjects(userId: string, workspaceId: string, isAdmin: boolean) {
  return prisma.project.findMany({
    where: visibleProjectsWhere({ workspaceId, userId, isAdmin }),
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: { id: true, name: true, color: true, archivedAt: true, metricsRange: true, metricsLead: true },
  });
}

export async function getMetrics(input: {
  userId: string;
  workspaceId: string;
  isAdmin: boolean;
  timeZone: string;
  // Straight from the URL: a preset, or two days picked on the calendar.
  rangeParam: string | string[] | undefined;
  fromParam: string | string[] | undefined;
  toParam: string | string[] | undefined;
  projectParam: string | string[] | undefined;
}) {
  const now = new Date();
  const projects = await visibleProjects(input.userId, input.workspaceId, input.isAdmin);
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const selected =
    typeof input.projectParam === "string" && projectById.has(input.projectParam) ? input.projectParam : null;
  // The chosen project says what the view opens with, as its admin set it:
  // the period, unless the URL names one, and the metric that goes first.
  // Every project together opens with the app's own.
  const defaults = metricDefaults(selected ? projectById.get(selected) : null);
  const range = resolveRange(
    { range: input.rangeParam, from: input.fromParam, to: input.toParam },
    input.timeZone,
    now,
    defaults.range,
  );
  const scope = { projectIds: selected ? [selected] : [...projectById.keys()], start: range.start, end: range.end, now };

  const [byPerson, byProjectRows, tasks, periodRows] = await Promise.all([
    minutesByPerson(prisma, scope),
    minutesByProject(prisma, scope),
    topTasks(prisma, scope, 10),
    minutesByPeriod(prisma, { ...scope, timeZone: input.timeZone, unit: range.unit }),
  ]);

  const byProject = byProjectRows.flatMap((row) => {
    const project = projectById.get(row.projectId);
    return project ? [{ ...row, id: project.id, name: project.name, color: project.color }] : [];
  });

  return {
    range,
    lead: defaults.lead,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      color: project.color,
      archived: project.archivedAt !== null,
      // The period its metrics open on, so the filters can show it at once.
      defaultRange: metricDefaults(project).range,
    })),
    selected,
    total: byProject.reduce((sum, project) => sum + project.minutes, 0),
    unpaid: byProject.reduce((sum, project) => sum + project.unpaid, 0),
    blocks: byProject.reduce((sum, project) => sum + project.blocks, 0),
    paidBlocks: byProject.reduce((sum, project) => sum + project.paidBlocks, 0),
    byPerson,
    byProject,
    tasks: tasks.flatMap((task) => {
      const project = projectById.get(task.projectId);
      return project ? [{ ...task, projectName: project.name, projectColor: project.color }] : [];
    }),
    series: periodSeries(periodRows, byProject, range.buckets),
  };
}

export type Metrics = Awaited<ReturnType<typeof getMetrics>>;
