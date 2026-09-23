import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { reconcileAccess } from "@/lib/access/onboarding";
import { createTestDb, createUser, type TestDb } from "@/lib/testing/db";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
});

const ADMINS = new Set(["ana@test.dev", "beto@test.dev"]);

async function membershipsOf(userId: string) {
  return db.prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true, role: true, status: true },
  });
}

async function projectsOf(userId: string) {
  return db.prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true, role: true },
    orderBy: { project: { name: "asc" } },
  });
}

/** Ana opens the workspace, then invites Dario to two projects, one per role. */
async function inviteDarioToProjects() {
  const ana = await createUser(db, "ana@test.dev");
  await reconcileAccess(db.prisma, ana, ADMINS);
  const workspace = await db.prisma.workspace.findFirstOrThrow();
  const web = await db.prisma.project.create({ data: { workspaceId: workspace.id, name: "Web", color: "blue" } });
  const app = await db.prisma.project.create({ data: { workspaceId: workspace.id, name: "App", color: "orange" } });
  await db.prisma.invitation.create({
    data: {
      workspaceId: workspace.id,
      email: "dario@test.dev",
      role: "MEMBER",
      projects: {
        create: [
          { projectId: web.id, role: "TRACKER" },
          { projectId: app.id, role: "VIEWER" },
        ],
      },
    },
  });
  return { web, app };
}

describe("reconcileAccess", () => {
  it("lets the first bootstrap admin create the workspace", async () => {
    const ana = await createUser(db, "Ana@Test.dev");

    await reconcileAccess(db.prisma, ana, ADMINS);

    expect(await db.prisma.workspace.count()).toBe(1);
    expect(await membershipsOf(ana.id)).toEqual([
      expect.objectContaining({ role: "ADMIN", status: "ACTIVE" }),
    ]);
  });

  it("adds later bootstrap admins to the same workspace", async () => {
    const ana = await createUser(db, "ana@test.dev");
    const beto = await createUser(db, "beto@test.dev");

    await reconcileAccess(db.prisma, ana, ADMINS);
    await reconcileAccess(db.prisma, beto, ADMINS);

    expect(await db.prisma.workspace.count()).toBe(1);
    expect(await membershipsOf(beto.id)).toEqual([
      expect.objectContaining({ role: "ADMIN", status: "ACTIVE" }),
    ]);
  });

  it("turns a stranger's first sign-in into a pending request", async () => {
    const ana = await createUser(db, "ana@test.dev");
    const carla = await createUser(db, "carla@test.dev");
    await reconcileAccess(db.prisma, ana, ADMINS);

    await reconcileAccess(db.prisma, carla, ADMINS);
    await reconcileAccess(db.prisma, carla, ADMINS);

    expect(await membershipsOf(carla.id)).toEqual([
      expect.objectContaining({ role: "MEMBER", status: "PENDING" }),
    ]);
  });

  it("activates an invited person with the invited role", async () => {
    const ana = await createUser(db, "ana@test.dev");
    await reconcileAccess(db.prisma, ana, ADMINS);
    const workspace = await db.prisma.workspace.findFirstOrThrow();
    await db.prisma.invitation.create({
      data: { workspaceId: workspace.id, email: "dario@test.dev", role: "MEMBER" },
    });

    const dario = await createUser(db, "Dario@Test.dev");
    await reconcileAccess(db.prisma, dario, ADMINS);

    expect(await membershipsOf(dario.id)).toEqual([
      expect.objectContaining({ role: "MEMBER", status: "ACTIVE" }),
    ]);
    const invitation = await db.prisma.invitation.findFirstOrThrow();
    expect(invitation.acceptedAt).toBeInstanceOf(Date);
  });

  it("activates a pending person once an admin invites them", async () => {
    const ana = await createUser(db, "ana@test.dev");
    const eva = await createUser(db, "eva@test.dev");
    await reconcileAccess(db.prisma, ana, ADMINS);
    await reconcileAccess(db.prisma, eva, ADMINS);
    const workspace = await db.prisma.workspace.findFirstOrThrow();
    await db.prisma.invitation.create({
      data: { workspaceId: workspace.id, email: "eva@test.dev", role: "MEMBER" },
    });

    await reconcileAccess(db.prisma, eva, ADMINS);

    expect(await membershipsOf(eva.id)).toEqual([
      expect.objectContaining({ role: "MEMBER", status: "ACTIVE" }),
    ]);
  });

  it("puts an invited person straight into the projects picked for them", async () => {
    const { web, app } = await inviteDarioToProjects();

    const dario = await createUser(db, "Dario@Test.dev");
    await reconcileAccess(db.prisma, dario, ADMINS);

    expect(await projectsOf(dario.id)).toEqual([
      { projectId: app.id, role: "VIEWER" },
      { projectId: web.id, role: "TRACKER" },
    ]);
  });

  it("applies the invited projects once, so later changes by an admin stick", async () => {
    const { web, app } = await inviteDarioToProjects();
    const dario = await createUser(db, "dario@test.dev");
    await reconcileAccess(db.prisma, dario, ADMINS);

    // An admin moves Dario from observer to tracker, then Dario signs in again.
    await db.prisma.projectMember.update({
      where: { projectId_userId: { projectId: app.id, userId: dario.id } },
      data: { role: "TRACKER" },
    });
    await reconcileAccess(db.prisma, dario, ADMINS);

    expect(await projectsOf(dario.id)).toEqual([
      { projectId: app.id, role: "TRACKER" },
      { projectId: web.id, role: "TRACKER" },
    ]);
  });

  it("does nothing for strangers before any workspace exists", async () => {
    const carla = await createUser(db, "carla@test.dev");

    await reconcileAccess(db.prisma, carla, ADMINS);

    expect(await db.prisma.workspace.count()).toBe(0);
    expect(await membershipsOf(carla.id)).toEqual([]);
  });
});
