import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  assignToProject,
  createProject,
  removeFromProject,
  setProjectArchived,
  updateProject,
} from "@/features/projects/projects";
import { reconcileAccess } from "@/lib/access/onboarding";
import { createTestDb, createUser, type TestDb } from "@/lib/testing/db";

let db: TestDb;
let workspaceId: string;
let adminId: string;

const ADMINS = new Set(["ana@test.dev"]);

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  const ana = await createUser(db, "ana@test.dev");
  await reconcileAccess(db.prisma, ana, ADMINS);
  workspaceId = (await db.prisma.workspace.findFirstOrThrow()).id;
  adminId = ana.id;
});

async function activeMember(email: string) {
  const user = await createUser(db, email);
  await db.prisma.workspaceMember.create({
    data: { workspaceId, userId: user.id, role: "MEMBER", status: "ACTIVE" },
  });
  return user;
}

describe("createProject", () => {
  it("creates the project with the next free color and makes its creator a tracker", async () => {
    const result = await createProject(db.prisma, { workspaceId, creatorId: adminId, name: "Fragua" });

    expect(result).toMatchObject({ ok: true });
    const project = await db.prisma.project.findFirstOrThrow({ include: { members: true } });
    expect(project).toMatchObject({ name: "Fragua", color: "blue", archivedAt: null });
    expect(project.members).toEqual([expect.objectContaining({ userId: adminId, role: "TRACKER" })]);
  });

  it("gives each new project the next color in order", async () => {
    await createProject(db.prisma, { workspaceId, creatorId: adminId, name: "Uno" });
    await createProject(db.prisma, { workspaceId, creatorId: adminId, name: "Dos" });

    const colors = (await db.prisma.project.findMany({ orderBy: { createdAt: "asc" } })).map((p) => p.color);
    expect(colors).toEqual(["blue", "orange"]);
  });

  it("refuses a duplicate name in the same workspace", async () => {
    await createProject(db.prisma, { workspaceId, creatorId: adminId, name: "Fragua" });

    expect(await createProject(db.prisma, { workspaceId, creatorId: adminId, name: "Fragua" })).toEqual({
      ok: false,
      reason: "nameTaken",
    });
  });
});

describe("updateProject / setProjectArchived", () => {
  it("renames and recolors a project", async () => {
    await createProject(db.prisma, { workspaceId, creatorId: adminId, name: "Viejo" });
    const project = await db.prisma.project.findFirstOrThrow();

    expect(await updateProject(db.prisma, workspaceId, project.id, { name: "Nuevo", color: "red" })).toEqual({ ok: true });
    expect(await db.prisma.project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({
      name: "Nuevo",
      color: "red",
    });
  });

  it("archives and restores without losing anything", async () => {
    await createProject(db.prisma, { workspaceId, creatorId: adminId, name: "Fragua" });
    const project = await db.prisma.project.findFirstOrThrow();

    await setProjectArchived(db.prisma, workspaceId, project.id, true);
    expect((await db.prisma.project.findUniqueOrThrow({ where: { id: project.id } })).archivedAt).toBeInstanceOf(Date);

    await setProjectArchived(db.prisma, workspaceId, project.id, false);
    expect((await db.prisma.project.findUniqueOrThrow({ where: { id: project.id } })).archivedAt).toBeNull();
  });

  it("ignores projects of another workspace", async () => {
    await createProject(db.prisma, { workspaceId, creatorId: adminId, name: "Fragua" });
    const project = await db.prisma.project.findFirstOrThrow();
    const other = await db.prisma.workspace.create({ data: { name: "Other" } });

    expect(await setProjectArchived(db.prisma, other.id, project.id, true)).toEqual({ ok: false, reason: "notFound" });
  });
});

describe("assignToProject / removeFromProject", () => {
  it("assigns an active member and changes their role on re-assignment", async () => {
    await createProject(db.prisma, { workspaceId, creatorId: adminId, name: "Fragua" });
    const project = await db.prisma.project.findFirstOrThrow();
    const beto = await activeMember("beto@test.dev");

    expect(await assignToProject(db.prisma, workspaceId, project.id, beto.id, "VIEWER")).toEqual({ ok: true });
    expect(await assignToProject(db.prisma, workspaceId, project.id, beto.id, "TRACKER")).toEqual({ ok: true });

    const membership = await db.prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: project.id, userId: beto.id } },
    });
    expect(membership.role).toBe("TRACKER");
  });

  it("refuses people who aren't active members of the workspace", async () => {
    await createProject(db.prisma, { workspaceId, creatorId: adminId, name: "Fragua" });
    const project = await db.prisma.project.findFirstOrThrow();
    const stranger = await createUser(db, "carla@test.dev");

    expect(await assignToProject(db.prisma, workspaceId, project.id, stranger.id, "TRACKER")).toEqual({
      ok: false,
      reason: "notMember",
    });
  });

  it("removes someone from a project", async () => {
    await createProject(db.prisma, { workspaceId, creatorId: adminId, name: "Fragua" });
    const project = await db.prisma.project.findFirstOrThrow();

    expect(await removeFromProject(db.prisma, workspaceId, project.id, adminId)).toEqual({ ok: true });
    expect(await db.prisma.projectMember.count()).toBe(0);
  });
});
