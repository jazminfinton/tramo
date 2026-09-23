import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";

/**
 * Metrics sums, done in SQL so the database does the work (on Vercel's free
 * plan every millisecond of function CPU comes out of a monthly budget).
 *
 * Shared rules, the same as the week view:
 * - a block belongs to the range (and the week) where it STARTED;
 * - a running block counts up to `now`;
 * - only the projects in `projectIds` count — the caller passes the ones the
 *   viewer may see (transparency per project).
 */

export type MetricsScope = { projectIds: string[]; start: Date; end: Date; now: Date };

const minutes = (now: Date) =>
  Prisma.sql`SUM(EXTRACT(EPOCH FROM (COALESCE(e."endedAt", ${now}) - e."startedAt")) / 60)::float8`;

const where = (scope: MetricsScope) => Prisma.sql`
  e."projectId" = ANY(${scope.projectIds})
  AND e."startedAt" >= ${scope.start}
  AND e."startedAt" < ${scope.end}`;

const round = <T extends { minutes: number }>(rows: T[]) =>
  rows.map((row) => ({ ...row, minutes: Math.round(row.minutes) }));

export async function minutesByPerson(db: PrismaClient, scope: MetricsScope) {
  if (scope.projectIds.length === 0) return [];
  return round(
    await db.$queryRaw<{ id: string; name: string; minutes: number }[]>`
      SELECT e."userId" AS id, u.name AS name, ${minutes(scope.now)} AS minutes
      FROM "TimeEntry" e JOIN "User" u ON u.id = e."userId"
      WHERE ${where(scope)}
      GROUP BY e."userId", u.name
      ORDER BY minutes DESC, u.name ASC`,
  );
}

export async function minutesByProject(db: PrismaClient, scope: MetricsScope) {
  if (scope.projectIds.length === 0) return [];
  return round(
    await db.$queryRaw<{ projectId: string; minutes: number }[]>`
      SELECT e."projectId" AS "projectId", ${minutes(scope.now)} AS minutes
      FROM "TimeEntry" e
      WHERE ${where(scope)}
      GROUP BY e."projectId"
      ORDER BY minutes DESC`,
  );
}

export async function topTasks(db: PrismaClient, scope: MetricsScope, limit: number) {
  if (scope.projectIds.length === 0) return [];
  return round(
    await db.$queryRaw<{ description: string; projectId: string; minutes: number }[]>`
      SELECT e.description AS description, e."projectId" AS "projectId", ${minutes(scope.now)} AS minutes
      FROM "TimeEntry" e
      WHERE ${where(scope)} AND e.description <> ''
      GROUP BY e.description, e."projectId"
      ORDER BY minutes DESC, e.description ASC
      LIMIT ${limit}`,
  );
}

/**
 * Minutes per project per local day or week, each bucket named by its first
 * day (ISO date): a week is its Monday.
 */
export async function minutesByPeriod(
  db: PrismaClient,
  scope: MetricsScope & { timeZone: string; unit: "day" | "week" },
) {
  if (scope.projectIds.length === 0) return [];
  return round(
    await db.$queryRaw<{ bucket: string; projectId: string; minutes: number }[]>`
      SELECT to_char(date_trunc(${scope.unit}, e."startedAt" AT TIME ZONE ${scope.timeZone}), 'YYYY-MM-DD') AS bucket,
             e."projectId" AS "projectId",
             ${minutes(scope.now)} AS minutes
      FROM "TimeEntry" e
      WHERE ${where(scope)}
      GROUP BY 1, 2
      ORDER BY 1 ASC, minutes DESC`,
  );
}
