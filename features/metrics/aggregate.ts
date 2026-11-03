import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";

/**
 * Metrics sums, done in SQL so the database does the work (on Vercel's free
 * plan every millisecond of function CPU comes out of a monthly budget).
 *
 * Shared rules, the same as the week view:
 * - a block belongs to the range (and the week) where it STARTED;
 * - a block counts for the time worked in it: its span minus its pauses. A
 *   running one counts up to `now`, a paused one up to its pause (the same
 *   sum as features/time/worked.ts, in SQL);
 * - only the projects in `projectIds` count — the caller passes the ones the
 *   viewer may see (transparency per project).
 */

export type MetricsScope = { projectIds: string[]; start: Date; end: Date; now: Date };

const worked = (now: Date) => Prisma.sql`GREATEST(0,
  EXTRACT(EPOCH FROM (COALESCE(e."endedAt", e."pausedAt", ${now}) - e."startedAt")) - e."pausedSeconds"
) / 60`;

const minutes = (now: Date) => Prisma.sql`SUM(${worked(now)})::float8`;

const paidMinutes = (now: Date) =>
  Prisma.sql`COALESCE(SUM(${worked(now)}) FILTER (WHERE e."paidAt" IS NOT NULL), 0)::float8`;

const unpaidMinutes = (now: Date) =>
  Prisma.sql`COALESCE(SUM(${worked(now)}) FILTER (WHERE e."paidAt" IS NULL), 0)::float8`;

const where = (scope: MetricsScope) => Prisma.sql`
  e."projectId" = ANY(${scope.projectIds})
  AND e."startedAt" >= ${scope.start}
  AND e."startedAt" < ${scope.end}`;

const round = <T extends { minutes: number }>(rows: T[]) =>
  rows.map((row) => ({ ...row, minutes: Math.round(row.minutes) }));

/** Minutes per person, and how many of them nobody has marked as paid, a running block included. */
export async function minutesByPerson(db: PrismaClient, scope: MetricsScope) {
  if (scope.projectIds.length === 0) return [];
  const rows = await db.$queryRaw<{ id: string; name: string; minutes: number; unpaid: number }[]>`
    SELECT e."userId" AS id, u.name AS name,
           ${minutes(scope.now)} AS minutes,
           ${unpaidMinutes(scope.now)} AS unpaid
    FROM "TimeEntry" e JOIN "User" u ON u.id = e."userId"
    WHERE ${where(scope)}
    GROUP BY e."userId", u.name
    ORDER BY minutes DESC, u.name ASC`;
  return round(rows).map((row) => ({ ...row, unpaid: Math.round(row.unpaid) }));
}

/**
 * Minutes per project, how many of them nobody has marked as paid, a running
 * block included, and its blocks: how many there are and how many are paid.
 */
export async function minutesByProject(db: PrismaClient, scope: MetricsScope) {
  if (scope.projectIds.length === 0) return [];
  const rows = await db.$queryRaw<
    { projectId: string; minutes: number; unpaid: number; blocks: number; paidBlocks: number }[]
  >`
    SELECT e."projectId" AS "projectId",
           ${minutes(scope.now)} AS minutes,
           ${unpaidMinutes(scope.now)} AS unpaid,
           COUNT(*)::int AS blocks,
           COUNT(*) FILTER (WHERE e."paidAt" IS NOT NULL)::int AS "paidBlocks"
    FROM "TimeEntry" e
    WHERE ${where(scope)}
    GROUP BY e."projectId"
    ORDER BY minutes DESC`;
  return round(rows).map((row) => ({ ...row, unpaid: Math.round(row.unpaid) }));
}

/**
 * What the time went into, per project. A block under a shared task counts
 * for that task, whatever detail is written next to it; any other block counts
 * for its description, and one with neither is left out. Free text that says
 * the same as a shared task adds up with it.
 */
export async function topTasks(db: PrismaClient, scope: MetricsScope, limit: number) {
  if (scope.projectIds.length === 0) return [];
  return round(
    await db.$queryRaw<{ name: string; projectId: string; minutes: number }[]>`
      SELECT COALESCE(t.name, e.description) AS name, e."projectId" AS "projectId", ${minutes(scope.now)} AS minutes
      FROM "TimeEntry" e LEFT JOIN "Task" t ON t.id = e."taskId"
      WHERE ${where(scope)} AND COALESCE(t.name, e.description) <> ''
      GROUP BY 1, 2
      ORDER BY minutes DESC, 1 ASC
      LIMIT ${limit}`,
  );
}

/**
 * Minutes per project per local day or week, and how many of them are marked
 * as paid. Each bucket is named by its first day (ISO date): a week is its Monday.
 */
export async function minutesByPeriod(
  db: PrismaClient,
  scope: MetricsScope & { timeZone: string; unit: "day" | "week" },
) {
  if (scope.projectIds.length === 0) return [];
  const rows = await db.$queryRaw<{ bucket: string; projectId: string; minutes: number; paid: number }[]>`
    SELECT to_char(date_trunc(${scope.unit}, e."startedAt" AT TIME ZONE ${scope.timeZone}), 'YYYY-MM-DD') AS bucket,
           e."projectId" AS "projectId",
           ${minutes(scope.now)} AS minutes,
           ${paidMinutes(scope.now)} AS paid
    FROM "TimeEntry" e
    WHERE ${where(scope)}
    GROUP BY 1, 2
    ORDER BY 1 ASC, minutes DESC`;
  return round(rows).map((row) => ({ ...row, paid: Math.round(row.paid) }));
}
