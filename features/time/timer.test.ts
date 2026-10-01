import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { finishTimer, pauseTimer, recentDescriptions, resumeTimer, startTimer } from "@/features/time/timer";
import { createTestDb, createUser, type TestDb } from "@/lib/testing/db";

let db: TestDb;
let workspaceId: string;
let userId: string;
let projectA: string;
let projectB: string;

const at = (iso: string) => new Date(iso);

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  const user = await createUser(db, "ana@test.dev");
  userId = user.id;
  const workspace = await db.prisma.workspace.create({
    data: { name: "Test", members: { create: { userId, role: "MEMBER", status: "ACTIVE" } } },
  });
  workspaceId = workspace.id;
  const a = await db.prisma.project.create({
    data: { workspaceId, name: "A", color: "blue", members: { create: { userId, role: "TRACKER" } } },
  });
  const b = await db.prisma.project.create({
    data: { workspaceId, name: "B", color: "orange", members: { create: { userId, role: "TRACKER" } } },
  });
  projectA = a.id;
  projectB = b.id;
});

const running = () => db.prisma.timeEntry.findFirst({ where: { userId, endedAt: null } });

describe("startTimer", () => {
  it("starts a running entry", async () => {
    const result = await startTimer(db.prisma, {
      userId,
      workspaceId,
      projectId: projectA,
      description: "Landing",
      now: at("2026-09-23T12:00:00Z"),
    });

    expect(result.ok).toBe(true);
    expect(await running()).toMatchObject({ projectId: projectA, description: "Landing", source: "TIMER" });
  });

  it("stops the previous timer when another one starts", async () => {
    await startTimer(db.prisma, { userId, workspaceId, projectId: projectA, description: "", now: at("2026-09-23T12:00:00Z") });
    await startTimer(db.prisma, { userId, workspaceId, projectId: projectB, description: "", now: at("2026-09-23T12:30:00Z") });

    const entries = await db.prisma.timeEntry.findMany({ where: { userId }, orderBy: { startedAt: "asc" } });
    expect(entries).toHaveLength(2);
    expect(entries[0]?.endedAt).toEqual(at("2026-09-23T12:30:00Z"));
    expect(entries[1]).toMatchObject({ projectId: projectB, endedAt: null });
  });

  it("does nothing when the same timer is already running", async () => {
    await startTimer(db.prisma, { userId, workspaceId, projectId: projectA, description: "X", now: at("2026-09-23T12:00:00Z") });
    await startTimer(db.prisma, { userId, workspaceId, projectId: projectA, description: "X", now: at("2026-09-23T12:05:00Z") });

    expect(await db.prisma.timeEntry.count({ where: { userId } })).toBe(1);
  });

  it("drops a zero-length entry instead of breaking the end-after-start rule", async () => {
    const now = at("2026-09-23T12:00:00Z");
    await startTimer(db.prisma, { userId, workspaceId, projectId: projectA, description: "", now });
    await startTimer(db.prisma, { userId, workspaceId, projectId: projectB, description: "", now });

    const entries = await db.prisma.timeEntry.findMany({ where: { userId } });
    expect(entries).toEqual([expect.objectContaining({ projectId: projectB, endedAt: null })]);
  });

  it("refuses projects where the person is only a viewer", async () => {
    await db.prisma.projectMember.update({
      where: { projectId_userId: { projectId: projectA, userId } },
      data: { role: "VIEWER" },
    });

    const result = await startTimer(db.prisma, {
      userId,
      workspaceId,
      projectId: projectA,
      description: "",
      now: at("2026-09-23T12:00:00Z"),
    });
    expect(result).toEqual({ ok: false, reason: "cannotTrack" });
  });

  it("refuses archived projects", async () => {
    await db.prisma.project.update({ where: { id: projectA }, data: { archivedAt: new Date() } });

    const result = await startTimer(db.prisma, {
      userId,
      workspaceId,
      projectId: projectA,
      description: "",
      now: at("2026-09-23T12:00:00Z"),
    });
    expect(result).toEqual({ ok: false, reason: "cannotTrack" });
  });
});

const open = () => db.prisma.timeEntry.findFirst({ where: { userId, endedAt: null } });
const allEntries = () => db.prisma.timeEntry.findMany({ where: { userId }, orderBy: { startedAt: "asc" } });
const start = (projectId: string, description: string, iso: string) =>
  startTimer(db.prisma, { userId, workspaceId, projectId, description, now: at(iso) });
const pause = (iso: string) => pauseTimer(db.prisma, { userId, now: at(iso) });
const resume = (iso: string) => resumeTimer(db.prisma, { userId, workspaceId, now: at(iso) });
const finish = (iso: string) => finishTimer(db.prisma, { userId, now: at(iso) });

describe("one entry per task, across pauses", () => {
  it("pauses without closing the entry", async () => {
    await start(projectA, "Landing", "2026-09-23T12:00:00Z");

    expect(await pause("2026-09-23T12:15:30Z")).toEqual({ ok: true });

    expect(await open()).toMatchObject({ pausedAt: at("2026-09-23T12:15:30Z"), pausedSeconds: 0, endedAt: null });
    expect(await allEntries()).toHaveLength(1);
  });

  it("resumes the same entry and leaves the pause out of its time", async () => {
    await start(projectA, "Landing", "2026-09-23T12:00:00Z");
    await pause("2026-09-23T12:10:00Z");

    expect(await resume("2026-09-23T12:30:00Z")).toEqual({ ok: true });

    expect(await open()).toMatchObject({ pausedAt: null, pausedSeconds: 1200 });
    expect(await allEntries()).toHaveLength(1);
  });

  it("adds up every pause of the task", async () => {
    await start(projectA, "Landing", "2026-09-23T12:00:00Z");
    await pause("2026-09-23T12:10:00Z");
    await resume("2026-09-23T12:30:00Z");
    await pause("2026-09-23T12:40:00Z");
    await resume("2026-09-23T12:45:00Z");

    expect(await open()).toMatchObject({ pausedAt: null, pausedSeconds: 1500 });
  });

  it("finishes into a single entry, from play to stop, with its pauses", async () => {
    await start(projectA, "Landing", "2026-09-23T12:00:00Z");
    await pause("2026-09-23T12:10:00Z");
    await resume("2026-09-23T12:30:00Z");

    expect(await finish("2026-09-23T13:00:00Z")).toEqual({ ok: true });

    expect(await open()).toBeNull();
    expect(await allEntries()).toEqual([
      expect.objectContaining({
        description: "Landing",
        startedAt: at("2026-09-23T12:00:00Z"),
        endedAt: at("2026-09-23T13:00:00Z"),
        pausedAt: null,
        pausedSeconds: 1200,
      }),
    ]);
  });

  it("finishes a paused task at the moment it was paused", async () => {
    await start(projectA, "Landing", "2026-09-23T12:00:00Z");
    await pause("2026-09-23T12:10:00Z");

    await finish("2026-09-23T12:50:00Z");

    expect(await allEntries()).toEqual([
      expect.objectContaining({ endedAt: at("2026-09-23T12:10:00Z"), pausedAt: null, pausedSeconds: 0 }),
    ]);
  });

  it("drops a task that has no time worked", async () => {
    await start(projectA, "Landing", "2026-09-23T12:00:00Z");
    await pause("2026-09-23T12:00:00Z");

    await finish("2026-09-23T12:20:00Z");

    expect(await allEntries()).toEqual([]);
  });

  it("ends the paused task where it was paused when a different one starts", async () => {
    await start(projectA, "Landing", "2026-09-23T12:00:00Z");
    await pause("2026-09-23T12:10:00Z");

    await start(projectB, "Deploy", "2026-09-23T12:20:00Z");

    expect(await allEntries()).toEqual([
      expect.objectContaining({ projectId: projectA, endedAt: at("2026-09-23T12:10:00Z") }),
      expect.objectContaining({ projectId: projectB, startedAt: at("2026-09-23T12:20:00Z"), endedAt: null, pausedSeconds: 0 }),
    ]);
  });

  it("goes on with the same entry when the paused task is started again", async () => {
    await start(projectA, "Landing", "2026-09-23T12:00:00Z");
    await pause("2026-09-23T12:10:00Z");

    await start(projectA, "Landing", "2026-09-23T12:30:00Z");

    expect(await allEntries()).toEqual([expect.objectContaining({ endedAt: null, pausedAt: null, pausedSeconds: 1200 })]);
  });

  it("can't resume what isn't open, and can't resume where the person no longer tracks", async () => {
    expect(await resume("2026-09-23T12:00:00Z")).toEqual({ ok: false, reason: "nothingPaused" });

    await start(projectA, "Landing", "2026-09-23T12:00:00Z");
    await pause("2026-09-23T12:10:00Z");
    await db.prisma.projectMember.update({
      where: { projectId_userId: { projectId: projectA, userId } },
      data: { role: "VIEWER" },
    });

    expect(await resume("2026-09-23T12:20:00Z")).toEqual({ ok: false, reason: "cannotTrack" });
  });

  it("takes a double click on pause, resume or finish in stride", async () => {
    await start(projectA, "Landing", "2026-09-23T12:00:00Z");
    await pause("2026-09-23T12:10:00Z");
    await pause("2026-09-23T12:10:01Z");
    expect(await open()).toMatchObject({ pausedAt: at("2026-09-23T12:10:00Z") });

    await resume("2026-09-23T12:11:00Z");
    await resume("2026-09-23T12:11:01Z");
    expect(await open()).toMatchObject({ pausedAt: null, pausedSeconds: 60 });

    expect(await finish("2026-09-23T12:12:00Z")).toEqual({ ok: true });
    expect(await finish("2026-09-23T12:12:01Z")).toEqual({ ok: true });
    expect(await allEntries()).toHaveLength(1);
  });

  it("no longer touches the retired timer session", async () => {
    await start(projectA, "Landing", "2026-09-23T12:00:00Z");
    await pause("2026-09-23T12:10:00Z");

    expect(await db.prisma.timerSession.count()).toBe(0);
  });
});

describe("recentDescriptions", () => {
  it("lists each project's past descriptions, most recent first, without repeats or blanks", async () => {
    await db.prisma.timeEntry.createMany({
      data: [
        { userId, projectId: projectA, description: "Landing", startedAt: at("2026-09-20T10:00:00Z"), endedAt: at("2026-09-20T11:00:00Z") },
        { userId, projectId: projectA, description: "Deploy", startedAt: at("2026-09-21T10:00:00Z"), endedAt: at("2026-09-21T11:00:00Z") },
        { userId, projectId: projectA, description: "Landing", startedAt: at("2026-09-22T10:00:00Z"), endedAt: at("2026-09-22T11:00:00Z") },
        { userId, projectId: projectA, description: "", startedAt: at("2026-09-22T12:00:00Z"), endedAt: at("2026-09-22T13:00:00Z") },
        { userId, projectId: projectB, description: "Diseño", startedAt: at("2026-09-22T14:00:00Z"), endedAt: at("2026-09-22T15:00:00Z") },
      ],
    });

    expect(await recentDescriptions(db.prisma, userId, [projectA, projectB])).toEqual({
      [projectA]: ["Landing", "Deploy"],
      [projectB]: ["Diseño"],
    });
  });
});
