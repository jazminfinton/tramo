import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { parseHistoryFilters, type HistoryFilters } from "@/features/time/history-filters";
import type { SharedTask } from "@/features/time/tasks";
import { visibleProjectsWhere } from "@/lib/access/permissions";
import { PAGE_SIZE, parsePageRequest, toPage, type PageRequest, type SearchParams } from "@/lib/pagination";
import { toSearchKey } from "@/lib/search";
import { shiftIsoDate, zonedInstant } from "@/lib/zoned";

/**
 * The history: every finished block in the projects this viewer can see, whoever
 * logged it (the usual transparency per project), filtered in the database.
 *
 * The filters live in one SQL statement that also adds up the totals and picks
 * the page, so a filter can't apply to the list and not to the total. Text is
 * folded as it's read, the same way `toSearchKey` folds what's typed: no extension
 * and no stored key to keep in sync on every write, since each query is already
 * narrowed by project.
 */

const ACCENTED = "ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç";
const PLAIN = "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc";

/** Only the filters that are on become conditions. */
function historyWhere(projectIds: string[], filters: HistoryFilters, timeZone: string) {
  const key = toSearchKey(filters.text);
  const days =
    filters.from && filters.to
      ? Prisma.sql`AND e."startedAt" >= ${zonedInstant(filters.from, 0, timeZone)}
        AND e."startedAt" < ${zonedInstant(shiftIsoDate(filters.to, 1), 0, timeZone)}`
      : Prisma.empty;
  // % and _ are wildcards to LIKE, and what's typed means them literally.
  const text = key
    ? Prisma.sql`AND lower(translate(e.description, ${ACCENTED}, ${PLAIN})) LIKE ${`%${key.replace(/[\\%_]/g, "\\$&")}%`} ESCAPE '\\'`
    : Prisma.empty;

  return Prisma.sql`e."projectId" = ANY(${projectIds})
    AND e."endedAt" IS NOT NULL
    ${filters.person ? Prisma.sql`AND e."userId" = ${filters.person}` : Prisma.empty}
    ${filters.task ? Prisma.sql`AND e."taskId" = ${filters.task}` : Prisma.empty}
    ${days}
    ${text}`;
}

/** The totals of what's filtered, and the ids of one page of it, in display order: one statement. */
async function findPage(db: PrismaClient, where: Prisma.Sql, request: PageRequest) {
  const cursor = request.after ?? request.before;
  // Walking back reads upward from the cursor, so the extra row ends up at the far end.
  const order = request.before ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const past = request.before ? Prisma.sql`>` : Prisma.sql`<`;

  const [row] = await db.$queryRaw<{ blocks: number; minutes: number; ids: string[] }[]>`
    WITH filtered AS (
      SELECT e.id, e."startedAt",
             GREATEST(0, EXTRACT(EPOCH FROM (e."endedAt" - e."startedAt")) - e."pausedSeconds") / 60 AS minutes
      FROM "TimeEntry" e
      WHERE ${where}
    ),
    shown AS (
      SELECT f.id, f."startedAt"
      FROM filtered f
      ${cursor ? Prisma.sql`WHERE (f."startedAt", f.id) ${past} (SELECT c."startedAt", c.id FROM "TimeEntry" c WHERE c.id = ${cursor})` : Prisma.empty}
      ORDER BY f."startedAt" ${order}, f.id ${order}
      LIMIT ${PAGE_SIZE + 1}
    )
    SELECT (SELECT COUNT(*)::int FROM filtered) AS blocks,
           (SELECT COALESCE(SUM(minutes), 0)::float8 FROM filtered) AS minutes,
           (SELECT COALESCE(array_agg(s.id ORDER BY s."startedAt" ${order}, s.id ${order}), ARRAY[]::text[]) FROM shown s) AS ids`;

  const ids = row?.ids ?? [];
  return {
    blocks: row?.blocks ?? 0,
    minutes: Math.round(row?.minutes ?? 0),
    ids: request.before ? ids.toReversed() : ids,
  };
}

/** The blocks of a page, newest first. Joined by hand: Prisma would read each relation in a statement of its own. */
async function readEntries(db: PrismaClient, ids: string[]) {
  const rows = await db.$queryRaw<
    {
      id: string;
      projectId: string;
      taskId: string | null;
      description: string;
      startedAt: Date;
      endedAt: Date | null;
      pausedAt: Date | null;
      pausedSeconds: number;
      paidAt: Date | null;
      source: "TIMER" | "MANUAL";
      editedAt: Date | null;
      projectName: string;
      projectColor: string;
      taskName: string | null;
      userId: string;
      userName: string;
    }[]
  >`
    SELECT e.id, e."projectId", e."taskId", e.description, e."startedAt", e."endedAt", e."pausedAt",
           e."pausedSeconds", e."paidAt", e.source::text AS source, e."editedAt",
           p.name AS "projectName", p.color AS "projectColor", t.name AS "taskName",
           u.id AS "userId", u.name AS "userName"
    FROM "TimeEntry" e
    JOIN "Project" p ON p.id = e."projectId"
    JOIN "User" u ON u.id = e."userId"
    LEFT JOIN "Task" t ON t.id = e."taskId"
    WHERE e.id = ANY(${ids})
    ORDER BY e."startedAt" DESC, e.id DESC`;

  return rows.map(({ projectName, projectColor, taskName, userId, userName, ...entry }) => ({
    ...entry,
    project: { name: projectName, color: projectColor },
    task: taskName === null ? null : { name: taskName },
    user: { id: userId, name: userName },
  }));
}

/** One page of the history for this viewer, or null if they see no project at all. */
export async function loadHistory(
  db: PrismaClient,
  input: {
    workspaceId: string;
    userId: string;
    isAdmin: boolean;
    timeZone: string;
    params: SearchParams;
    /** The workspace's team tasks: a filter can only name one of them. */
    tasks: SharedTask[];
  },
) {
  const projects = await db.project.findMany({ where: visibleProjectsWhere(input), select: { id: true } });
  if (projects.length === 0) return null;
  const projectIds = projects.map((project) => project.id);

  // By the hours and not by who's a member today: someone who left is still part
  // of the history. It doesn't narrow with the filters, so anyone is one click away.
  const people = await db.user.findMany({
    where: { timeEntries: { some: { projectId: { in: projectIds } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const asked = parseHistoryFilters(input.params);
  const filters: HistoryFilters = {
    ...asked,
    person: people.some((person) => person.id === asked.person) ? asked.person : null,
    task: input.tasks.some((task) => task.id === asked.task) ? asked.task : null,
  };
  const where = historyWhere(projectIds, filters, input.timeZone);

  let request = parsePageRequest(input.params);
  let found = await findPage(db, where, request);
  // The block a page stood on is gone: back to the first one, not to an empty list.
  if (found.ids.length === 0 && (request.after || request.before)) {
    request = {};
    found = await findPage(db, where, request);
  }

  const page = toPage(
    found.ids.map((id) => ({ id })),
    request,
  );
  const entries =
    page.items.length === 0
      ? []
      : await readEntries(
          db,
          page.items.map((item) => item.id),
        );

  return {
    filters,
    people,
    entries,
    blocks: found.blocks,
    minutes: found.minutes,
    nextCursor: page.nextCursor,
    prevCursor: page.prevCursor,
  };
}

export type History = NonNullable<Awaited<ReturnType<typeof loadHistory>>>;
export type HistoryEntry = History["entries"][number];
