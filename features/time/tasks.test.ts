import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { entryTitle, taskNameKey } from "@/features/time/task-text";
import { createTask, listTasks, taskInWorkspace } from "@/features/time/tasks";
import { createTestDb, createUser, type TestDb } from "@/lib/testing/db";

let db: TestDb;
let workspaceId: string;
let ana: string; // tracks a project
let vera: string; // only views one
let projectId: string;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  ana = (await createUser(db, "ana@test.dev")).id;
  vera = (await createUser(db, "vera@test.dev")).id;
  const workspace = await db.prisma.workspace.create({
    data: {
      name: "Test",
      members: {
        create: [
          { userId: ana, role: "MEMBER", status: "ACTIVE" },
          { userId: vera, role: "MEMBER", status: "ACTIVE" },
        ],
      },
    },
  });
  workspaceId = workspace.id;
  projectId = (
    await db.prisma.project.create({
      data: {
        workspaceId,
        name: "A",
        color: "blue",
        members: { create: [{ userId: ana, role: "TRACKER" }, { userId: vera, role: "VIEWER" }] },
      },
    })
  ).id;
});

const add = (name: string, userId = ana, isAdmin = false) =>
  createTask(db.prisma, { actor: { userId, isAdmin }, workspaceId, name });

describe("taskNameKey", () => {
  it("compares names without case or extra spaces", () => {
    expect(taskNameKey("  Daily   Standup ")).toBe("daily standup");
    expect(taskNameKey("DAILY standup")).toBe("daily standup");
  });
});

describe("createTask", () => {
  it("adds a task to the workspace, with its name tidied up", async () => {
    const result = await add("  Revisión   de código ");

    expect(result).toEqual({ ok: true, task: { id: expect.any(String), name: "Revisión de código" } });
    expect(await db.prisma.task.findFirstOrThrow()).toMatchObject({
      workspaceId,
      name: "Revisión de código",
      nameKey: "revisión de código",
      createdById: ana,
    });
  });

  it("hands back the task that already exists instead of a duplicate", async () => {
    const first = await add("Daily");
    const again = await add("  daily ");

    expect(again).toEqual(first);
    expect(await db.prisma.task.count()).toBe(1);
  });

  it("is open to anyone who tracks time, and to admins, but not to people who only watch", async () => {
    expect(await add("Deploy", vera)).toEqual({ ok: false, reason: "cannotTrack" });
    expect((await add("Deploy", vera, true)).ok).toBe(true);
    expect((await add("Soporte", ana)).ok).toBe(true);
  });

  it("stops counting an archived project as tracking", async () => {
    await db.prisma.project.update({ where: { id: projectId }, data: { archivedAt: new Date() } });

    expect(await add("Deploy")).toEqual({ ok: false, reason: "cannotTrack" });
  });

  it("keeps each workspace's tasks apart", async () => {
    const other = await db.prisma.workspace.create({ data: { name: "Other" } });
    await db.prisma.task.create({ data: { workspaceId: other.id, name: "Daily", nameKey: "daily" } });

    expect((await add("Daily")).ok).toBe(true);
    expect(await db.prisma.task.count()).toBe(2);
  });
});

describe("listTasks", () => {
  it("lists the workspace's tasks by name", async () => {
    await add("Soporte");
    await add("daily");
    await add("Revisión de código");

    expect((await listTasks(db.prisma, workspaceId)).map((task) => task.name)).toEqual([
      "daily",
      "Revisión de código",
      "Soporte",
    ]);
  });
});

describe("taskInWorkspace", () => {
  it("accepts no task, and a task of this workspace only", async () => {
    const mine = await db.prisma.task.create({ data: { workspaceId, name: "Daily", nameKey: "daily" } });
    const other = await db.prisma.workspace.create({ data: { name: "Other" } });
    const theirs = await db.prisma.task.create({ data: { workspaceId: other.id, name: "Daily", nameKey: "daily" } });

    expect(await taskInWorkspace(db.prisma, null, workspaceId)).toBe(true);
    expect(await taskInWorkspace(db.prisma, mine.id, workspaceId)).toBe(true);
    expect(await taskInWorkspace(db.prisma, theirs.id, workspaceId)).toBe(false);
    expect(await taskInWorkspace(db.prisma, "nope", workspaceId)).toBe(false);
  });
});

describe("entryTitle", () => {
  it("leads with the shared task, then the detail", () => {
    expect(entryTitle({ task: { name: "Daily" }, description: "con el cliente" })).toBe("Daily · con el cliente");
    expect(entryTitle({ task: { name: "Daily" }, description: "" })).toBe("Daily");
    expect(entryTitle({ task: null, description: "Landing" })).toBe("Landing");
    expect(entryTitle({ task: null, description: "" })).toBe("");
  });
});
