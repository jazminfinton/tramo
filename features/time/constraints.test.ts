import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, createUser, type TestDb } from "@/lib/testing/db";

// The guarantees the database itself enforces on time entries and the shared
// tasks they sit under, independent of any application code. See the TimeEntry
// and Task models in prisma/schema.prisma.

let db: TestDb;
let workspaceId: string;
let projectId: string;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  workspaceId = (await db.prisma.workspace.create({ data: { name: "Test" } })).id;
  const project = await db.prisma.project.create({
    data: { workspaceId, name: "Demo", color: "c1" },
  });
  projectId = project.id;
});

const at = (iso: string) => new Date(iso);

describe("one running timer per person", () => {
  it("rejects a second running entry for the same person", async () => {
    const user = await createUser(db, "ana@test.dev");
    await db.prisma.timeEntry.create({
      data: { userId: user.id, projectId, startedAt: at("2026-09-21T13:00:00Z") },
    });

    await expect(
      db.prisma.timeEntry.create({
        data: { userId: user.id, projectId, startedAt: at("2026-09-21T14:00:00Z") },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows running entries for different people", async () => {
    const ana = await createUser(db, "ana@test.dev");
    const beto = await createUser(db, "beto@test.dev");

    await db.prisma.timeEntry.create({
      data: { userId: ana.id, projectId, startedAt: at("2026-09-21T13:00:00Z") },
    });
    await expect(
      db.prisma.timeEntry.create({
        data: { userId: beto.id, projectId, startedAt: at("2026-09-21T13:00:00Z") },
      }),
    ).resolves.toBeDefined();
  });

  it("allows any number of finished entries next to a running one", async () => {
    const user = await createUser(db, "ana@test.dev");
    await db.prisma.timeEntry.createMany({
      data: [
        { userId: user.id, projectId, startedAt: at("2026-09-21T09:00:00Z"), endedAt: at("2026-09-21T10:00:00Z") },
        { userId: user.id, projectId, startedAt: at("2026-09-21T10:30:00Z"), endedAt: at("2026-09-21T11:00:00Z") },
        { userId: user.id, projectId, startedAt: at("2026-09-21T12:00:00Z") },
      ],
    });

    expect(await db.prisma.timeEntry.count({ where: { userId: user.id } })).toBe(3);
  });
});

describe("entries end after they start", () => {
  it("rejects an end before the start", async () => {
    const user = await createUser(db, "ana@test.dev");

    await expect(
      db.prisma.timeEntry.create({
        data: {
          userId: user.id,
          projectId,
          startedAt: at("2026-09-21T10:00:00Z"),
          endedAt: at("2026-09-21T09:00:00Z"),
        },
      }),
    ).rejects.toThrow(/TimeEntry_ends_after_start/);
  });

  it("rejects a zero-length entry", async () => {
    const user = await createUser(db, "ana@test.dev");

    await expect(
      db.prisma.timeEntry.create({
        data: {
          userId: user.id,
          projectId,
          startedAt: at("2026-09-21T10:00:00Z"),
          endedAt: at("2026-09-21T10:00:00Z"),
        },
      }),
    ).rejects.toThrow(/TimeEntry_ends_after_start/);
  });
});

describe("pauses inside an entry", () => {
  it("lets an open entry be paused, and keeps the paused time once it's over", async () => {
    const user = await createUser(db, "ana@test.dev");
    const entry = await db.prisma.timeEntry.create({
      data: { userId: user.id, projectId, startedAt: at("2026-09-21T10:00:00Z"), pausedAt: at("2026-09-21T10:30:00Z") },
    });

    await expect(
      db.prisma.timeEntry.update({
        where: { id: entry.id },
        data: { pausedAt: null, pausedSeconds: 900, endedAt: at("2026-09-21T12:00:00Z") },
      }),
    ).resolves.toMatchObject({ pausedSeconds: 900 });
  });

  it("rejects a pause on a finished entry", async () => {
    const user = await createUser(db, "ana@test.dev");

    await expect(
      db.prisma.timeEntry.create({
        data: {
          userId: user.id,
          projectId,
          startedAt: at("2026-09-21T10:00:00Z"),
          endedAt: at("2026-09-21T11:00:00Z"),
          pausedAt: at("2026-09-21T10:30:00Z"),
        },
      }),
    ).rejects.toThrow(/TimeEntry_paused_only_while_open/);
  });

  it("rejects a pause that begins before the entry", async () => {
    const user = await createUser(db, "ana@test.dev");

    await expect(
      db.prisma.timeEntry.create({
        data: { userId: user.id, projectId, startedAt: at("2026-09-21T10:00:00Z"), pausedAt: at("2026-09-21T09:00:00Z") },
      }),
    ).rejects.toThrow(/TimeEntry_paused_only_while_open/);
  });

  it("rejects negative paused time", async () => {
    const user = await createUser(db, "ana@test.dev");

    await expect(
      db.prisma.timeEntry.create({
        data: { userId: user.id, projectId, startedAt: at("2026-09-21T10:00:00Z"), pausedSeconds: -1 },
      }),
    ).rejects.toThrow(/TimeEntry_paused_seconds_not_negative/);
  });

  it("rejects a finished entry whose pauses leave no time worked", async () => {
    const user = await createUser(db, "ana@test.dev");

    await expect(
      db.prisma.timeEntry.create({
        data: {
          userId: user.id,
          projectId,
          startedAt: at("2026-09-21T10:00:00Z"),
          endedAt: at("2026-09-21T11:00:00Z"),
          pausedSeconds: 3600,
        },
      }),
    ).rejects.toThrow(/TimeEntry_worked_time_positive/);
  });
});

describe("shared tasks", () => {
  const daily = (workspace: string) => ({ workspaceId: workspace, name: "Daily", nameKey: "daily" });

  it("rejects a second task with the same name in a workspace, but not in another one", async () => {
    const other = await db.prisma.workspace.create({ data: { name: "Other" } });
    await db.prisma.task.create({ data: daily(workspaceId) });

    await expect(db.prisma.task.create({ data: { ...daily(workspaceId), name: "DAILY" } })).rejects.toMatchObject({
      code: "P2002",
    });
    await expect(db.prisma.task.create({ data: daily(other.id) })).resolves.toBeDefined();
  });

  it("keeps an entry, without its task, when the task goes away", async () => {
    const user = await createUser(db, "ana@test.dev");
    const task = await db.prisma.task.create({ data: daily(workspaceId) });
    const entry = await db.prisma.timeEntry.create({
      data: {
        userId: user.id,
        projectId,
        taskId: task.id,
        description: "con el cliente",
        startedAt: at("2026-09-21T10:00:00Z"),
        endedAt: at("2026-09-21T11:00:00Z"),
      },
    });

    await db.prisma.task.delete({ where: { id: task.id } });

    expect(await db.prisma.timeEntry.findUniqueOrThrow({ where: { id: entry.id } })).toMatchObject({
      taskId: null,
      description: "con el cliente",
    });
  });

  it("keeps a task when the person who added it leaves", async () => {
    const user = await createUser(db, "ana@test.dev");
    const task = await db.prisma.task.create({ data: { ...daily(workspaceId), createdById: user.id } });

    await db.prisma.user.delete({ where: { id: user.id } });

    expect(await db.prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ createdById: null });
  });
});
