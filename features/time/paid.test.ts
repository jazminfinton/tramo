import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { paidRangePreview, setDayPaid, setEntryPaid, setRangePaid } from "@/features/time/paid";
import { createTestDb, createUser, type TestDb } from "@/lib/testing/db";

const AR = "America/Argentina/Buenos_Aires"; // UTC-3
const at = (iso: string) => new Date(iso);
const now = at("2026-09-25T15:00:00Z");
const earlier = at("2026-09-24T15:00:00Z");

let db: TestDb;
let workspaceId: string;
let otherWorkspaceId: string;
let ana: string;
let beto: string;
let projectId: string;
let otherProjectId: string;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  ana = (await createUser(db, "ana@test.dev")).id;
  beto = (await createUser(db, "beto@test.dev")).id;
  workspaceId = (await db.prisma.workspace.create({ data: { name: "Test" } })).id;
  otherWorkspaceId = (await db.prisma.workspace.create({ data: { name: "Other" } })).id;
  projectId = (await db.prisma.project.create({ data: { workspaceId, name: "A", color: "blue" } })).id;
  otherProjectId = (
    await db.prisma.project.create({ data: { workspaceId: otherWorkspaceId, name: "A", color: "blue" } })
  ).id;
});

function block(
  start: string,
  end: string | null,
  over: { userId?: string; projectId?: string; paidAt?: Date; paidById?: string; pausedSeconds?: number } = {},
) {
  return db.prisma.timeEntry.create({
    data: { userId: ana, projectId, startedAt: at(start), endedAt: end ? at(end) : null, ...over },
  });
}

const stored = (id: string) => db.prisma.timeEntry.findUniqueOrThrow({ where: { id } });

describe("setEntryPaid", () => {
  const mark = (entryId: string, paid = true, userId = ana, workspace = workspaceId) =>
    setEntryPaid(db.prisma, { userId, workspaceId: workspace, entryId, paid, now });

  it("marks a finished block, remembering when and who", async () => {
    const entry = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    expect(await mark(entry.id)).toEqual({ ok: true });
    expect(await stored(entry.id)).toMatchObject({ paidAt: now, paidById: ana });
  });

  it("takes the mark off", async () => {
    const entry = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z", { paidAt: earlier, paidById: ana });

    expect(await mark(entry.id, false)).toEqual({ ok: true });
    expect(await stored(entry.id)).toMatchObject({ paidAt: null, paidById: null });
  });

  it("lets the owner take off a mark somebody else made", async () => {
    const entry = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z", { paidAt: earlier, paidById: beto });

    expect(await mark(entry.id, false)).toEqual({ ok: true });
    expect(await stored(entry.id)).toMatchObject({ paidAt: null, paidById: null });
  });

  it("keeps the first date when it's marked again (a double click)", async () => {
    const entry = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z", { paidAt: earlier });

    expect(await mark(entry.id)).toEqual({ ok: true });
    expect((await stored(entry.id)).paidAt).toEqual(earlier);
  });

  it("doesn't count as editing the block", async () => {
    const entry = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    await mark(entry.id);

    expect((await stored(entry.id)).editedAt).toBeNull();
  });

  it("refuses a block still open", async () => {
    const entry = await block("2026-09-23T12:00:00Z", null);

    expect(await mark(entry.id)).toEqual({ ok: false, reason: "running" });
    expect((await stored(entry.id)).paidAt).toBeNull();
  });

  it("refuses somebody else's block: only its owner marks it", async () => {
    const entry = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    expect(await mark(entry.id, true, beto)).toEqual({ ok: false, reason: "forbidden" });
    expect((await stored(entry.id)).paidAt).toBeNull();
  });

  it("doesn't find a block of another workspace, or one that's gone", async () => {
    const theirs = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z", { projectId: otherProjectId });

    expect(await mark(theirs.id)).toEqual({ ok: false, reason: "notFound" });
    expect(await mark("nope")).toEqual({ ok: false, reason: "notFound" });
    expect((await stored(theirs.id)).paidAt).toBeNull();
  });
});

describe("setDayPaid", () => {
  const markDay = (day: string, paid = true, userId = ana) =>
    setDayPaid(db.prisma, { userId, workspaceId, day, timeZone: AR, paid, now });

  it("marks the day's finished blocks", async () => {
    const morning = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");
    const afternoon = await block("2026-09-23T17:00:00Z", "2026-09-23T18:00:00Z");

    expect(await markDay("2026-09-23")).toEqual({ ok: true });

    expect(await stored(morning.id)).toMatchObject({ paidAt: now, paidById: ana });
    expect(await stored(afternoon.id)).toMatchObject({ paidAt: now, paidById: ana });
  });

  it("reads the day on the person's clock", async () => {
    // 00:30 UTC on the 24th is still the 23rd in Buenos Aires.
    const lateAtNight = await block("2026-09-24T00:30:00Z", "2026-09-24T01:30:00Z");
    // 03:30 UTC on the 24th is already the 24th there.
    const nextMorning = await block("2026-09-24T03:30:00Z", "2026-09-24T04:30:00Z");

    await markDay("2026-09-23");

    expect((await stored(lateAtNight.id)).paidAt).toEqual(now);
    expect((await stored(nextMorning.id)).paidAt).toBeNull();
  });

  it("counts a block on the day it started, even if it ends on the next", async () => {
    const overnight = await block("2026-09-24T02:00:00Z", "2026-09-24T05:00:00Z");

    await markDay("2026-09-24");
    expect((await stored(overnight.id)).paidAt).toBeNull();

    await markDay("2026-09-23");
    expect((await stored(overnight.id)).paidAt).toEqual(now);
  });

  it("leaves out a block still open", async () => {
    const finished = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");
    const open = await block("2026-09-23T17:00:00Z", null);

    expect(await markDay("2026-09-23")).toEqual({ ok: true });

    expect((await stored(finished.id)).paidAt).toEqual(now);
    expect((await stored(open.id)).paidAt).toBeNull();
  });

  it("keeps the date of the blocks already marked", async () => {
    const before = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z", { paidAt: earlier });
    const after = await block("2026-09-23T17:00:00Z", "2026-09-23T18:00:00Z");

    await markDay("2026-09-23");

    expect((await stored(before.id)).paidAt).toEqual(earlier);
    expect((await stored(after.id)).paidAt).toEqual(now);
  });

  it("takes the mark off the whole day", async () => {
    const morning = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z", { paidAt: earlier });
    const nextDay = await block("2026-09-24T12:00:00Z", "2026-09-24T13:00:00Z", { paidAt: earlier });

    expect(await markDay("2026-09-23", false)).toEqual({ ok: true });

    expect((await stored(morning.id)).paidAt).toBeNull();
    expect((await stored(nextDay.id)).paidAt).toEqual(earlier);
  });

  it("only touches the hours of the person who marks them", async () => {
    const theirs = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z", { userId: beto });

    await markDay("2026-09-23");

    expect((await stored(theirs.id)).paidAt).toBeNull();
  });

  it("only touches the hours of this workspace", async () => {
    const elsewhere = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z", { projectId: otherProjectId });

    await markDay("2026-09-23");

    expect((await stored(elsewhere.id)).paidAt).toBeNull();
  });

  it("doesn't count as editing the blocks", async () => {
    const entry = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    await markDay("2026-09-23");

    expect((await stored(entry.id)).editedAt).toBeNull();
  });
});

describe("setRangePaid", () => {
  const SEPTEMBER = { from: "2026-09-01", to: "2026-09-30" };
  const member = { userId: ana, isAdmin: false };

  const markRange = (
    over: Partial<Parameters<typeof setRangePaid>[1]> = {},
  ) =>
    setRangePaid(db.prisma, {
      actor: { userId: ana, isAdmin: false },
      workspaceId,
      ...SEPTEMBER,
      timeZone: AR,
      projectId: null,
      paid: true,
      now,
      ...over,
    });

  it("marks a person's finished blocks in the range, saying how many", async () => {
    const first = await block("2026-09-01T12:00:00Z", "2026-09-01T13:00:00Z");
    const last = await block("2026-09-30T12:00:00Z", "2026-09-30T13:00:00Z");

    expect(await markRange()).toEqual({ count: 2 });

    expect(await stored(first.id)).toMatchObject({ paidAt: now, paidById: ana });
    expect(await stored(last.id)).toMatchObject({ paidAt: now, paidById: ana });
  });

  it("takes both days whole, on the person's clock", async () => {
    // 02:30 UTC on the 1st is still August 31st in Buenos Aires.
    const before = await block("2026-09-01T02:30:00Z", "2026-09-01T02:45:00Z");
    // 02:30 UTC on October 1st is still September 30th there.
    const lastNight = await block("2026-10-01T02:30:00Z", "2026-10-01T02:45:00Z");
    // 03:30 UTC on October 1st is already October there.
    const after = await block("2026-10-01T03:30:00Z", "2026-10-01T04:30:00Z");

    expect(await markRange()).toEqual({ count: 1 });

    expect((await stored(before.id)).paidAt).toBeNull();
    expect((await stored(lastNight.id)).paidAt).toEqual(now);
    expect((await stored(after.id)).paidAt).toBeNull();
  });

  it("only touches a member's own hours", async () => {
    const theirs = await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { userId: beto });

    expect(await markRange()).toEqual({ count: 0 });

    expect((await stored(theirs.id)).paidAt).toBeNull();
  });

  it("lets an admin mark the whole team's, remembering who did", async () => {
    const mine = await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z");
    const theirs = await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { userId: beto });

    expect(await markRange({ actor: { userId: ana, isAdmin: true } })).toEqual({ count: 2 });

    expect(await stored(mine.id)).toMatchObject({ paidAt: now, paidById: ana });
    expect(await stored(theirs.id)).toMatchObject({ paidAt: now, paidById: ana });
  });

  it("sticks to the chosen project", async () => {
    const other = await db.prisma.project.create({ data: { workspaceId, name: "B", color: "red" } });
    const chosen = await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z");
    const notChosen = await block("2026-09-11T12:00:00Z", "2026-09-11T13:00:00Z", { projectId: other.id });

    expect(await markRange({ projectId })).toEqual({ count: 1 });

    expect((await stored(chosen.id)).paidAt).toEqual(now);
    expect((await stored(notChosen.id)).paidAt).toBeNull();
  });

  it("leaves out a block still open", async () => {
    const open = await block("2026-09-10T12:00:00Z", null);

    expect(await markRange()).toEqual({ count: 0 });

    expect((await stored(open.id)).paidAt).toBeNull();
  });

  it("keeps the date and the author of the blocks already marked", async () => {
    const before = await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { paidAt: earlier, paidById: beto });

    expect(await markRange()).toEqual({ count: 0 });

    expect(await stored(before.id)).toMatchObject({ paidAt: earlier, paidById: beto });
  });

  it("takes the mark off, saying how many", async () => {
    const inside = await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { paidAt: earlier, paidById: beto });
    const outside = await block("2026-10-10T12:00:00Z", "2026-10-10T13:00:00Z", { paidAt: earlier, paidById: beto });
    await block("2026-09-12T12:00:00Z", "2026-09-12T13:00:00Z");

    expect(await markRange({ paid: false })).toEqual({ count: 1 });

    expect(await stored(inside.id)).toMatchObject({ paidAt: null, paidById: null });
    expect(await stored(outside.id)).toMatchObject({ paidAt: earlier, paidById: beto });
  });

  it("only touches this workspace, even for an admin", async () => {
    const elsewhere = await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { projectId: otherProjectId });

    expect(await markRange({ actor: { userId: ana, isAdmin: true } })).toEqual({ count: 0 });
    expect(await markRange({ actor: { userId: ana, isAdmin: true }, projectId: otherProjectId })).toEqual({ count: 0 });

    expect((await stored(elsewhere.id)).paidAt).toBeNull();
  });

  it("doesn't count as editing the blocks", async () => {
    const entry = await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z");

    await markRange();

    expect((await stored(entry.id)).editedAt).toBeNull();
  });

  it("sends one statement, however many blocks the range holds", async () => {
    await db.prisma.timeEntry.createMany({
      data: Array.from({ length: 300 }, (_, index) => ({
        userId: ana,
        projectId,
        startedAt: new Date(Date.UTC(2026, 8, 10, 0, index * 2)),
        endedAt: new Date(Date.UTC(2026, 8, 10, 0, index * 2 + 1)),
      })),
    });

    let result: unknown;
    const sent = await db.statementsOf(async () => {
      result = await markRange({ actor: { ...member, userId: ana, isAdmin: true } });
    });

    expect(result).toEqual({ count: 300 });
    expect(sent).toHaveLength(1);
  });
});

describe("paidRangePreview", () => {
  const preview = (over: Partial<Parameters<typeof paidRangePreview>[1]> = {}) =>
    paidRangePreview(db.prisma, {
      actor: { userId: ana, isAdmin: false },
      workspaceId,
      from: "2026-09-01",
      to: "2026-09-30",
      timeZone: AR,
      projectId: null,
      ...over,
    });

  it("is empty with nothing in the range", async () => {
    expect(await preview()).toEqual({ unpaidCount: 0, unpaidMinutes: 0, paidCount: 0 });
  });

  it("counts what's left to pay and what's already paid, with the time worked", async () => {
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z");
    await block("2026-09-11T12:00:00Z", "2026-09-11T14:00:00Z", { pausedSeconds: 1800 });
    await block("2026-09-12T12:00:00Z", "2026-09-12T13:00:00Z", { paidAt: earlier });

    expect(await preview()).toEqual({ unpaidCount: 2, unpaidMinutes: 150, paidCount: 1 });
  });

  it("leaves out open blocks and days outside the range", async () => {
    await block("2026-09-10T12:00:00Z", null);
    await block("2026-10-10T12:00:00Z", "2026-10-10T13:00:00Z");

    expect(await preview()).toEqual({ unpaidCount: 0, unpaidMinutes: 0, paidCount: 0 });
  });

  it("covers the same blocks marking would: a member's own, an admin's whole team", async () => {
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z");
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { userId: beto });

    expect((await preview()).unpaidCount).toBe(1);
    expect((await preview({ actor: { userId: ana, isAdmin: true } })).unpaidCount).toBe(2);
  });

  it("sticks to the chosen project and to this workspace", async () => {
    const other = await db.prisma.project.create({ data: { workspaceId, name: "B", color: "red" } });
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z");
    await block("2026-09-11T12:00:00Z", "2026-09-11T13:00:00Z", { projectId: other.id });
    await block("2026-09-12T12:00:00Z", "2026-09-12T13:00:00Z", { projectId: otherProjectId });

    expect((await preview()).unpaidCount).toBe(2);
    expect((await preview({ projectId })).unpaidCount).toBe(1);
    expect((await preview({ projectId: otherProjectId })).unpaidCount).toBe(0);
  });

  it("asks the database once", async () => {
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z");

    expect(await db.statementsOf(() => preview())).toHaveLength(1);
  });
});
