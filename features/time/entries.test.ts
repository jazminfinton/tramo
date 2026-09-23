import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createManualEntry, deleteEntry, updateEntry } from "@/features/time/entries";
import { createTestDb, createUser, type TestDb } from "@/lib/testing/db";

let db: TestDb;
let workspaceId: string;
let ana: string;
let beto: string;
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
  ana = (await createUser(db, "ana@test.dev")).id;
  beto = (await createUser(db, "beto@test.dev")).id;
  const workspace = await db.prisma.workspace.create({
    data: {
      name: "Test",
      members: {
        create: [
          { userId: ana, role: "MEMBER", status: "ACTIVE" },
          { userId: beto, role: "MEMBER", status: "ACTIVE" },
        ],
      },
    },
  });
  workspaceId = workspace.id;
  projectA = (
    await db.prisma.project.create({
      data: {
        workspaceId,
        name: "A",
        color: "blue",
        members: { create: [{ userId: ana, role: "TRACKER" }, { userId: beto, role: "TRACKER" }] },
      },
    })
  ).id;
  projectB = (
    await db.prisma.project.create({
      data: { workspaceId, name: "B", color: "orange", members: { create: { userId: ana, role: "VIEWER" } } },
    })
  ).id;
});

const actor = (userId: string, isAdmin = false) => ({ userId, isAdmin });

async function anaEntry(start: string, end: string | null) {
  return db.prisma.timeEntry.create({
    data: { userId: ana, projectId: projectA, startedAt: at(start), endedAt: end ? at(end) : null },
  });
}

describe("createManualEntry", () => {
  it("adds a block flagged as manual", async () => {
    const result = await createManualEntry(db.prisma, {
      actor: actor(ana),
      workspaceId,
      projectId: projectA,
      description: "Reunión",
      startedAt: at("2026-09-23T12:00:00Z"),
      endedAt: at("2026-09-23T13:00:00Z"),
    });

    expect(result).toEqual({ ok: true });
    expect(await db.prisma.timeEntry.findFirstOrThrow()).toMatchObject({ source: "MANUAL", description: "Reunión" });
  });

  it("refuses a block that overlaps another one", async () => {
    await anaEntry("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    expect(
      await createManualEntry(db.prisma, {
        actor: actor(ana),
        workspaceId,
        projectId: projectA,
        description: "",
        startedAt: at("2026-09-23T12:30:00Z"),
        endedAt: at("2026-09-23T14:00:00Z"),
      }),
    ).toEqual({ ok: false, reason: "overlap" });
  });

  it("accepts a block that starts exactly when another ends", async () => {
    await anaEntry("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    expect(
      await createManualEntry(db.prisma, {
        actor: actor(ana),
        workspaceId,
        projectId: projectA,
        description: "",
        startedAt: at("2026-09-23T13:00:00Z"),
        endedAt: at("2026-09-23T14:00:00Z"),
      }),
    ).toEqual({ ok: true });
  });

  it("treats a running timer as occupying its time", async () => {
    await anaEntry("2026-09-23T12:00:00Z", null);

    expect(
      await createManualEntry(db.prisma, {
        actor: actor(ana),
        workspaceId,
        projectId: projectA,
        description: "",
        startedAt: at("2026-09-23T12:30:00Z"),
        endedAt: at("2026-09-23T12:45:00Z"),
      }),
    ).toEqual({ ok: false, reason: "overlap" });
  });

  it("does not compare against other people's blocks", async () => {
    await db.prisma.timeEntry.create({
      data: { userId: beto, projectId: projectA, startedAt: at("2026-09-23T12:00:00Z"), endedAt: at("2026-09-23T13:00:00Z") },
    });

    expect(
      await createManualEntry(db.prisma, {
        actor: actor(ana),
        workspaceId,
        projectId: projectA,
        description: "",
        startedAt: at("2026-09-23T12:00:00Z"),
        endedAt: at("2026-09-23T13:00:00Z"),
      }),
    ).toEqual({ ok: true });
  });

  it("refuses projects where the person only views", async () => {
    expect(
      await createManualEntry(db.prisma, {
        actor: actor(ana),
        workspaceId,
        projectId: projectB,
        description: "",
        startedAt: at("2026-09-23T12:00:00Z"),
        endedAt: at("2026-09-23T13:00:00Z"),
      }),
    ).toEqual({ ok: false, reason: "cannotTrack" });
  });
});

describe("updateEntry", () => {
  const change = (entryId: string, who: { userId: string; isAdmin: boolean }, start: string, end: string, projectId = projectA) =>
    updateEntry(db.prisma, {
      actor: who,
      workspaceId,
      entryId,
      projectId,
      description: "Editado",
      startedAt: at(start),
      endedAt: at(end),
    });

  it("lets people fix their own blocks, flagging the edit", async () => {
    const entry = await anaEntry("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    expect(await change(entry.id, actor(ana), "2026-09-23T11:30:00Z", "2026-09-23T13:00:00Z")).toEqual({ ok: true });
    const updated = await db.prisma.timeEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(updated).toMatchObject({ startedAt: at("2026-09-23T11:30:00Z"), description: "Editado" });
    expect(updated.editedAt).toBeInstanceOf(Date);
  });

  it("does not collide with the block being edited", async () => {
    const entry = await anaEntry("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    expect(await change(entry.id, actor(ana), "2026-09-23T12:15:00Z", "2026-09-23T13:15:00Z")).toEqual({ ok: true });
  });

  it("refuses edits that create an overlap", async () => {
    await anaEntry("2026-09-23T14:00:00Z", "2026-09-23T15:00:00Z");
    const entry = await anaEntry("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    expect(await change(entry.id, actor(ana), "2026-09-23T12:00:00Z", "2026-09-23T14:30:00Z")).toEqual({
      ok: false,
      reason: "overlap",
    });
  });

  it("keeps other members' blocks off limits, but not for admins", async () => {
    const entry = await anaEntry("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    expect(await change(entry.id, actor(beto), "2026-09-23T12:00:00Z", "2026-09-23T13:30:00Z")).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(await change(entry.id, actor(beto, true), "2026-09-23T12:00:00Z", "2026-09-23T13:30:00Z")).toEqual({
      ok: true,
    });
  });

  it("leaves a running timer to the timer", async () => {
    const entry = await anaEntry("2026-09-23T12:00:00Z", null);

    expect(await change(entry.id, actor(ana), "2026-09-23T11:00:00Z", "2026-09-23T12:30:00Z")).toEqual({
      ok: false,
      reason: "running",
    });
  });

  it("only moves a block to a project its owner tracks", async () => {
    const entry = await anaEntry("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    expect(await change(entry.id, actor(ana), "2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z", projectB)).toEqual({
      ok: false,
      reason: "cannotTrack",
    });
  });
});

describe("deleteEntry", () => {
  it("deletes your own block, not someone else's unless you're an admin", async () => {
    const entry = await anaEntry("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");

    expect(await deleteEntry(db.prisma, { actor: actor(beto), workspaceId, entryId: entry.id })).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(await deleteEntry(db.prisma, { actor: actor(ana), workspaceId, entryId: entry.id })).toEqual({ ok: true });
    expect(await db.prisma.timeEntry.count()).toBe(0);
  });

  it("ignores entries of other workspaces", async () => {
    const entry = await anaEntry("2026-09-23T12:00:00Z", "2026-09-23T13:00:00Z");
    const other = await db.prisma.workspace.create({ data: { name: "Other" } });

    expect(await deleteEntry(db.prisma, { actor: actor(ana, true), workspaceId: other.id, entryId: entry.id })).toEqual({
      ok: false,
      reason: "notFound",
    });
  });
});
