import "server-only";

import { listTeamEntries } from "@/features/time/team";
import { recentDescriptions } from "@/features/time/timer";
import { timerState } from "@/features/time/timer-state";
import { bucketWeek, resolveWeek } from "@/features/time/week";
import { prisma } from "@/lib/db";
import { weekRange, zonedDateKey } from "@/lib/zoned";

const ENTRY_SELECT = {
  id: true,
  projectId: true,
  description: true,
  startedAt: true,
  endedAt: true,
  source: true,
  editedAt: true,
  project: { select: { name: true, color: true } },
} as const;

/** What the entry dialog needs: where this person can log time, and their past tasks. */
async function getEntryFormData(userId: string, workspaceId: string) {
  const projects = await prisma.project.findMany({
    where: { workspaceId, archivedAt: null, members: { some: { userId, role: "TRACKER" } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
  const suggestions = await recentDescriptions(
    prisma,
    userId,
    projects.map((project) => project.id),
  );
  return { projects, suggestions };
}

/** Everything the timer page needs for one person in one workspace. */
export async function getTimerPageData(userId: string, workspaceId: string) {
  const [form, running, session, recent] = await Promise.all([
    getEntryFormData(userId, workspaceId),
    prisma.timeEntry.findFirst({
      where: { userId, endedAt: null, project: { workspaceId } },
      select: {
        projectId: true,
        description: true,
        startedAt: true,
        project: { select: { name: true, color: true } },
      },
    }),
    // The task across pauses, if it belongs to this workspace.
    prisma.timerSession.findFirst({
      where: { userId, project: { workspaceId } },
      select: {
        projectId: true,
        description: true,
        doneSeconds: true,
        project: { select: { name: true, color: true } },
      },
    }),
    prisma.timeEntry.findMany({
      where: { userId, endedAt: { not: null }, project: { workspaceId } },
      orderBy: { startedAt: "desc" },
      take: 8,
      select: ENTRY_SELECT,
    }),
  ]);

  return {
    ...form,
    timer: timerState(running, session),
    recent,
    // The server's clock, so the client can correct its own when computing
    // the elapsed time (a laptop clock a few minutes off shouldn't show up).
    serverNow: Date.now(),
  };
}

export type TimerPageData = Awaited<ReturnType<typeof getTimerPageData>>;

/** One person's week: the blocks, their totals per project and day, and the entry form data. */
export async function getWeekData(
  userId: string,
  workspaceId: string,
  weekParam: string | string[] | undefined,
  timeZone: string,
) {
  const now = new Date();
  const week = resolveWeek(weekParam, timeZone, now);
  const range = weekRange(week, timeZone);

  const [form, entries] = await Promise.all([
    getEntryFormData(userId, workspaceId),
    prisma.timeEntry.findMany({
      where: { userId, project: { workspaceId }, startedAt: { gte: range.start, lt: range.end } },
      orderBy: { startedAt: "asc" },
      select: ENTRY_SELECT,
    }),
  ]);

  const projectsById = new Map(entries.map((entry) => [entry.projectId, entry.project]));

  return {
    ...form,
    week,
    range,
    today: zonedDateKey(now, timeZone),
    currentWeek: resolveWeek(undefined, timeZone, now),
    entries,
    buckets: bucketWeek(entries, range.days, timeZone, now),
    weekProjects: [...projectsById].map(([id, project]) => ({ id, ...project })),
  };
}

export type WeekData = Awaited<ReturnType<typeof getWeekData>>;

/**
 * The team's week: every block in the projects this person can see, logged by
 * anyone, with hours per person and per day. What observers see instead of a
 * week of their own, and what trackers see under "Equipo".
 */
export async function getTeamWeekData(input: {
  userId: string;
  workspaceId: string;
  isAdmin: boolean;
  weekParam: string | string[] | undefined;
  timeZone: string;
}) {
  const now = new Date();
  const week = resolveWeek(input.weekParam, input.timeZone, now);
  const range = weekRange(week, input.timeZone);
  const entries = await listTeamEntries(prisma, { ...input, start: range.start, end: range.end });
  const buckets = bucketWeek(entries, range.days, input.timeZone, now, (entry) => entry.user.id);

  // People by hours this week, most first; the table and the list follow this order.
  const people = [...new Map(entries.map((entry) => [entry.user.id, entry.user])).values()];
  const minutesOf = (id: string) => (buckets.byKey.get(id) ?? []).reduce((sum, value) => sum + value, 0);
  people.sort((a, b) => minutesOf(b.id) - minutesOf(a.id) || a.name.localeCompare(b.name));

  return {
    week,
    range,
    today: zonedDateKey(now, input.timeZone),
    currentWeek: resolveWeek(undefined, input.timeZone, now),
    entries,
    buckets,
    people,
  };
}

export type TeamWeekData = Awaited<ReturnType<typeof getTeamWeekData>>;
