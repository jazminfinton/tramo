import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { setDayPaid, setEntryPaid } from "@/features/time/paid";
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

function block(start: string, end: string | null, over: { userId?: string; projectId?: string; paidAt?: Date } = {}) {
  return db.prisma.timeEntry.create({
    data: { userId: ana, projectId, startedAt: at(start), endedAt: end ? at(end) : null, ...over },
  });
}

const stored = (id: string) => db.prisma.timeEntry.findUniqueOrThrow({ where: { id } });

describe("setEntryPaid", () => {
  const mark = (entryId: string, paid = true, userId = ana, workspace = workspaceId) =>
    setEntryPaid(db.prisma, { userId, workspaceId: workspace, entryId, paid, now });

  it("marks a finished block, remembering when", async () => {
    const entry = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    expect(await mark(entry.id)).toEqual({ ok: true });
    expect((await stored(entry.id)).paidAt).toEqual(now);
  });

  it("takes the mark off", async () => {
    const entry = await block("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z", { paidAt: earlier });

    expect(await mark(entry.id, false)).toEqual({ ok: true });
    expect((await stored(entry.id)).paidAt).toBeNull();
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

    expect((await stored(morning.id)).paidAt).toEqual(now);
    expect((await stored(afternoon.id)).paidAt).toEqual(now);
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
