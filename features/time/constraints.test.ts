import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, createUser, type TestDb } from "@/lib/testing/db";

// The guarantees the database itself enforces on time entries, independent of
// any application code. See the TimeEntry model in prisma/schema.prisma.

let db: TestDb;
let projectId: string;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  const workspace = await db.prisma.workspace.create({ data: { name: "Test" } });
  const project = await db.prisma.project.create({
    data: { workspaceId: workspace.id, name: "Demo", color: "c1" },
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
