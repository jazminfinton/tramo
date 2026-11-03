import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { shiftIsoDate, zonedInstant } from "@/lib/zoned";

/**
 * Marking hours as paid (owner's decisions, see openspec/.../discovery.md):
 * - People mark their own hours: a single block, a whole day or a range of days.
 *   An admin's range covers the person they choose, or the whole team, since a
 *   client may pay a period for everyone. A block or a day is always one's own,
 *   admins included.
 * - The mark lives on each block, as the moment it was made and who made it. So
 *   a day is paid, partly paid or unpaid according to its blocks, and a block
 *   added later to a paid day comes in unpaid.
 * - Only a finished block can carry it: an open one still has hours to come.
 * - Marking isn't editing: a marked block isn't flagged as edited.
 *
 * Marking in bulk is one statement, whatever the number of blocks: an
 * `updateMany` is atomic by itself, so there's no loop and no transaction around
 * it, which would only add round trips.
 */

export type PaidResult = { ok: true } | { ok: false; reason: "notFound" | "forbidden" | "running" };

const markBy = (userId: string, paid: boolean, now: Date) =>
  paid ? { paidAt: now, paidById: userId } : { paidAt: null, paidById: null };

export async function setEntryPaid(
  db: PrismaClient,
  input: { userId: string; workspaceId: string; entryId: string; paid: boolean; now: Date },
): Promise<PaidResult> {
  const entry = await db.timeEntry.findFirst({
    where: { id: input.entryId, project: { workspaceId: input.workspaceId } },
    select: { id: true, userId: true, endedAt: true, paidAt: true },
  });
  if (!entry) return { ok: false, reason: "notFound" };
  if (entry.userId !== input.userId) return { ok: false, reason: "forbidden" };
  if (entry.endedAt === null) return { ok: false, reason: "running" };

  // Already marked (a double click): it keeps the date it was first marked on.
  if (input.paid && entry.paidAt) return { ok: true };

  await db.timeEntry.update({ where: { id: entry.id }, data: markBy(input.userId, input.paid, input.now) });
  return { ok: true };
}

/** Which finished blocks a range of days covers: whole days on the viewer's clock, as a block belongs to the day it started. */
export type PaidRange = {
  actor: { userId: string; isAdmin: boolean };
  workspaceId: string;
  from: string;
  to: string;
  timeZone: string;
  /** Just this project's hours; null covers all of them. */
  projectId: string | null;
  /** Just this person's hours; null covers the whole team. Only an admin chooses: see `ownerOf`. */
  personId: string | null;
};

function rangeBounds({ from, to, timeZone }: PaidRange) {
  return { gte: zonedInstant(from, 0, timeZone), lt: zonedInstant(shiftIsoDate(to, 1), 0, timeZone) };
}

/** Whose hours a range reaches, null being everyone's. Anyone but an admin gets their own, whoever they ask for. */
const ownerOf = ({ actor, personId }: PaidRange) => (actor.isAdmin ? personId : actor.userId);

/** The blocks of a range, in SQL: the same ones `setRangePaid` touches. Needs "TimeEntry" e and "Project" p. */
function rangeWhere(input: PaidRange) {
  const { gte, lt } = rangeBounds(input);
  const owner = ownerOf(input);
  return Prisma.sql`p."workspaceId" = ${input.workspaceId}
      AND e."endedAt" IS NOT NULL
      AND e."startedAt" >= ${gte}
      AND e."startedAt" < ${lt}
      ${owner ? Prisma.sql`AND e."userId" = ${owner}` : Prisma.empty}
      ${input.projectId ? Prisma.sql`AND e."projectId" = ${input.projectId}` : Prisma.empty}`;
}

/**
 * Marks the finished blocks of a range, or takes the mark off them, and says how
 * many changed. A block already marked keeps its date and its author.
 */
export async function setRangePaid(
  db: PrismaClient,
  input: PaidRange & { paid: boolean; now: Date },
): Promise<{ count: number }> {
  const owner = ownerOf(input);
  const { count } = await db.timeEntry.updateMany({
    where: {
      ...(owner ? { userId: owner } : {}),
      project: { workspaceId: input.workspaceId, ...(input.projectId ? { id: input.projectId } : {}) },
      startedAt: rangeBounds(input),
      endedAt: { not: null },
      paidAt: input.paid ? null : { not: null },
    },
    data: markBy(input.actor.userId, input.paid, input.now),
  });
  return { count };
}

/** Marks a person's own finished blocks of one day: the range of a single day. */
export async function setDayPaid(
  db: PrismaClient,
  input: { userId: string; workspaceId: string; day: string; timeZone: string; paid: boolean; now: Date },
): Promise<PaidResult> {
  await setRangePaid(db, {
    actor: { userId: input.userId, isAdmin: false },
    workspaceId: input.workspaceId,
    from: input.day,
    to: input.day,
    timeZone: input.timeZone,
    projectId: null,
    personId: null,
    paid: input.paid,
    now: input.now,
  });
  return { ok: true };
}

export type PaidRangePreview = { unpaidCount: number; unpaidMinutes: number; paidCount: number };

/** What marking a range would touch, before doing it: the same blocks as `setRangePaid`, in one query. */
export async function paidRangePreview(db: PrismaClient, input: PaidRange): Promise<PaidRangePreview> {
  const [row] = await db.$queryRaw<PaidRangePreview[]>`
    SELECT COUNT(*) FILTER (WHERE e."paidAt" IS NULL)::int AS "unpaidCount",
           COUNT(*) FILTER (WHERE e."paidAt" IS NOT NULL)::int AS "paidCount",
           COALESCE(
             SUM(GREATEST(0, EXTRACT(EPOCH FROM (e."endedAt" - e."startedAt")) - e."pausedSeconds") / 60)
               FILTER (WHERE e."paidAt" IS NULL),
             0
           )::float8 AS "unpaidMinutes"
    FROM "TimeEntry" e JOIN "Project" p ON p.id = e."projectId"
    WHERE ${rangeWhere(input)}`;
  return row ?? { unpaidCount: 0, unpaidMinutes: 0, paidCount: 0 };
}

export type PaidDay = { day: string; paid: number; unpaid: number };

/** The same blocks as `setRangePaid`, counted per day on the viewer's clock, in order: what a calendar marks. Days without any are left out. */
export async function paidDays(db: PrismaClient, input: PaidRange): Promise<PaidDay[]> {
  return db.$queryRaw<PaidDay[]>`
    SELECT to_char(e."startedAt" AT TIME ZONE ${input.timeZone}, 'YYYY-MM-DD') AS day,
           COUNT(*) FILTER (WHERE e."paidAt" IS NOT NULL)::int AS paid,
           COUNT(*) FILTER (WHERE e."paidAt" IS NULL)::int AS unpaid
    FROM "TimeEntry" e JOIN "Project" p ON p.id = e."projectId"
    WHERE ${rangeWhere(input)}
    GROUP BY 1
    ORDER BY 1 ASC`;
}

/**
 * Who has hours to mark in a workspace, by name. It goes by the hours and not by
 * who's a member today: someone who left may still have a period to be paid.
 */
export function payablePeople(db: PrismaClient, workspaceId: string) {
  return db.user.findMany({
    where: { timeEntries: { some: { project: { workspaceId } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
