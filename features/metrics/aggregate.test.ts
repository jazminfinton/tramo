import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { minutesByPeriod, minutesByPerson, minutesByProject, topTasks } from "@/features/metrics/aggregate";
import { createTestDb, createUser, type TestDb } from "@/lib/testing/db";

const AR = "America/Argentina/Buenos_Aires";
const now = new Date("2026-09-24T15:00:00Z");
const range = { start: new Date("2026-09-14T03:00:00Z"), end: new Date("2026-09-28T03:00:00Z") };

let db: TestDb;
let workspaceId: string;
let ana: string;
let beto: string;
let projectA: string;
let projectB: string;
let hidden: string;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  ana = (await createUser(db, "ana@test.dev", "Ana")).id;
  beto = (await createUser(db, "beto@test.dev", "Beto")).id;
  workspaceId = (await db.prisma.workspace.create({ data: { name: "Test" } })).id;
  const project = (name: string, color: string) =>
    db.prisma.project.create({ data: { workspaceId, name, color } }).then((p) => p.id);
  projectA = await project("A", "blue");
  projectB = await project("B", "orange");
  hidden = await project("Hidden", "red");

  await db.prisma.timeEntry.createMany({
    data: [
      block(ana, projectA, "Landing", "2026-09-15T12:00:00Z", "2026-09-15T14:00:00Z"), // week 14: 120
      block(ana, projectA, "Landing", "2026-09-22T12:00:00Z", "2026-09-22T13:00:00Z"), // week 21: 60
      block(beto, projectB, "Deploy", "2026-09-22T14:00:00Z", "2026-09-22T14:30:00Z"), // week 21: 30
      block(beto, projectA, "", "2026-09-24T14:00:00Z", null), // running: 60 until now
      block(ana, hidden, "Secreto", "2026-09-22T09:00:00Z", "2026-09-22T11:00:00Z"), // not visible
      block(ana, projectA, "Old", "2026-09-01T12:00:00Z", "2026-09-01T13:00:00Z"), // outside range
    ],
  });
});

const block = (userId: string, projectId: string, description: string, start: string, end: string | null) => ({
  userId,
  projectId,
  description,
  startedAt: new Date(start),
  endedAt: end ? new Date(end) : null,
});

const scope = () => ({ projectIds: [projectA, projectB], ...range, now });

describe("metrics aggregation (real Postgres)", () => {
  it("adds minutes per person, only for visible projects in range, running blocks up to now", async () => {
    expect(await minutesByPerson(db.prisma, scope())).toEqual([
      { id: ana, name: "Ana", minutes: 180 },
      { id: beto, name: "Beto", minutes: 90 },
    ]);
  });

  it("adds minutes per project", async () => {
    expect(await minutesByProject(db.prisma, scope())).toEqual([
      { projectId: projectA, minutes: 240 },
      { projectId: projectB, minutes: 30 },
    ]);
  });

  it("ranks tasks by time, skipping blank descriptions", async () => {
    expect(await topTasks(db.prisma, scope(), 5)).toEqual([
      { name: "Landing", projectId: projectA, minutes: 180 },
      { name: "Deploy", projectId: projectB, minutes: 30 },
    ]);
  });

  it("ranks a shared task under its own name, whatever detail is written next to it", async () => {
    const daily = await db.prisma.task.create({ data: { workspaceId, name: "Daily", nameKey: "daily" } });
    await db.prisma.timeEntry.deleteMany();
    await db.prisma.timeEntry.createMany({
      data: [
        { ...block(ana, projectA, "con el cliente", "2026-09-22T12:00:00Z", "2026-09-22T13:00:00Z"), taskId: daily.id },
        { ...block(beto, projectA, "", "2026-09-22T12:00:00Z", "2026-09-22T12:30:00Z"), taskId: daily.id },
        // Free text that says the same as the shared task adds up with it.
        block(ana, projectA, "Daily", "2026-09-23T12:00:00Z", "2026-09-23T12:15:00Z"),
        // The same shared task in another project is that project's row.
        { ...block(beto, projectB, "", "2026-09-23T12:00:00Z", "2026-09-23T12:20:00Z"), taskId: daily.id },
        block(ana, projectA, "Landing", "2026-09-23T13:00:00Z", "2026-09-23T15:00:00Z"),
      ],
    });

    expect(await topTasks(db.prisma, scope(), 5)).toEqual([
      { name: "Landing", projectId: projectA, minutes: 120 },
      { name: "Daily", projectId: projectA, minutes: 105 },
      { name: "Daily", projectId: projectB, minutes: 20 },
    ]);
  });

  it("buckets by local week (Monday) per project", async () => {
    expect(await minutesByPeriod(db.prisma, { ...scope(), timeZone: AR, unit: "week" })).toEqual([
      { bucket: "2026-09-14", projectId: projectA, minutes: 120 },
      { bucket: "2026-09-21", projectId: projectA, minutes: 120 },
      { bucket: "2026-09-21", projectId: projectB, minutes: 30 },
    ]);
  });

  it("buckets by local day per project", async () => {
    expect(await minutesByPeriod(db.prisma, { ...scope(), timeZone: AR, unit: "day" })).toEqual([
      { bucket: "2026-09-15", projectId: projectA, minutes: 120 },
      { bucket: "2026-09-22", projectId: projectA, minutes: 60 },
      { bucket: "2026-09-22", projectId: projectB, minutes: 30 },
      { bucket: "2026-09-24", projectId: projectA, minutes: 60 },
    ]);
  });

  it("leaves pauses out of every sum, and counts a paused block up to its pause", async () => {
    await db.prisma.timeEntry.deleteMany();
    await db.prisma.timeEntry.createMany({
      data: [
        // 2 h with half an hour paused: 90 worked.
        {
          userId: ana,
          projectId: projectA,
          description: "Landing",
          startedAt: new Date("2026-09-22T12:00:00Z"),
          endedAt: new Date("2026-09-22T14:00:00Z"),
          pausedSeconds: 1800,
        },
        // Open and paused at 14:20 after 5 min of earlier pauses: 15 worked, whatever `now` says.
        {
          userId: beto,
          projectId: projectA,
          description: "",
          startedAt: new Date("2026-09-24T14:00:00Z"),
          endedAt: null,
          pausedAt: new Date("2026-09-24T14:20:00Z"),
          pausedSeconds: 300,
        },
      ],
    });

    expect(await minutesByPerson(db.prisma, scope())).toEqual([
      { id: ana, name: "Ana", minutes: 90 },
      { id: beto, name: "Beto", minutes: 15 },
    ]);
    expect(await minutesByProject(db.prisma, scope())).toEqual([{ projectId: projectA, minutes: 105 }]);
    expect(await topTasks(db.prisma, scope(), 5)).toEqual([{ name: "Landing", projectId: projectA, minutes: 90 }]);
  });

  it("returns nothing when no project is visible", async () => {
    expect(await minutesByPerson(db.prisma, { ...scope(), projectIds: [] })).toEqual([]);
  });
});
