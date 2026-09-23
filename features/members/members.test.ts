import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  approveMember,
  inviteToWorkspace,
  rejectMember,
  revokeInvitation,
  setMemberRole,
} from "@/features/members/members";
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

async function requestAccess(email: string) {
  const user = await createUser(db, email);
  await reconcileAccess(db.prisma, user, ADMINS);
  const member = await db.prisma.workspaceMember.findFirstOrThrow({ where: { userId: user.id } });
  return { user, member };
}

const adminMember = () =>
  db.prisma.workspaceMember.findFirstOrThrow({ where: { userId: adminId } });

function createProject(name: string, options: { workspaceId?: string; archivedAt?: Date } = {}) {
  return db.prisma.project.create({
    data: { workspaceId: options.workspaceId ?? workspaceId, name, color: "blue", archivedAt: options.archivedAt },
  });
}

const invitedProjects = () =>
  db.prisma.invitationProject.findMany({ select: { projectId: true, role: true }, orderBy: { role: "asc" } });

type InvitedProject = { projectId: string; role: "TRACKER" | "VIEWER" };

const invite = (email: string, projects: InvitedProject[]) =>
  inviteToWorkspace(db.prisma, { workspaceId, invitedById: adminId, email, role: "MEMBER", adminEmails: ADMINS, projects });

describe("approveMember / rejectMember", () => {
  it("approves a pending request", async () => {
    const { member } = await requestAccess("carla@test.dev");

    expect(await approveMember(db.prisma, workspaceId, member.id)).toEqual({ ok: true });
    expect((await db.prisma.workspaceMember.findUniqueOrThrow({ where: { id: member.id } })).status).toBe("ACTIVE");
  });

  it("rejects a pending request", async () => {
    const { member } = await requestAccess("carla@test.dev");

    expect(await rejectMember(db.prisma, workspaceId, member.id, adminId)).toEqual({ ok: true });
    expect((await db.prisma.workspaceMember.findUniqueOrThrow({ where: { id: member.id } })).status).toBe("REJECTED");
  });

  it("never lets an admin reject themselves", async () => {
    const self = await adminMember();
    expect(await rejectMember(db.prisma, workspaceId, self.id, adminId)).toEqual({ ok: false, reason: "self" });
  });

  it("ignores members of another workspace", async () => {
    const { member } = await requestAccess("carla@test.dev");
    const other = await db.prisma.workspace.create({ data: { name: "Other" } });

    expect(await approveMember(db.prisma, other.id, member.id)).toEqual({ ok: false, reason: "notFound" });
  });
});

describe("setMemberRole", () => {
  it("promotes an active member to admin", async () => {
    const { member } = await requestAccess("carla@test.dev");
    await approveMember(db.prisma, workspaceId, member.id);

    expect(await setMemberRole(db.prisma, workspaceId, member.id, "ADMIN")).toEqual({ ok: true });
    expect((await db.prisma.workspaceMember.findUniqueOrThrow({ where: { id: member.id } })).role).toBe("ADMIN");
  });

  it("keeps at least one active admin", async () => {
    const self = await adminMember();
    expect(await setMemberRole(db.prisma, workspaceId, self.id, "MEMBER")).toEqual({
      ok: false,
      reason: "lastAdmin",
    });
  });
});

describe("inviteToWorkspace", () => {
  it("stores a normalized invitation", async () => {
    const result = await inviteToWorkspace(db.prisma, {
      workspaceId,
      invitedById: adminId,
      email: "nuevo@test.dev",
      role: "MEMBER",
      adminEmails: ADMINS,
    });

    expect(result).toEqual({ ok: true });
    expect(await db.prisma.invitation.findFirst({ where: { email: "nuevo@test.dev" } })).toMatchObject({
      role: "MEMBER",
      acceptedAt: null,
    });
  });

  it("activates right away someone who already asked for access", async () => {
    const { member } = await requestAccess("carla@test.dev");

    await inviteToWorkspace(db.prisma, {
      workspaceId,
      invitedById: adminId,
      email: "carla@test.dev",
      role: "MEMBER",
      adminEmails: ADMINS,
    });

    expect((await db.prisma.workspaceMember.findUniqueOrThrow({ where: { id: member.id } })).status).toBe("ACTIVE");
  });

  it("refuses to invite someone who is already an active member", async () => {
    const result = await inviteToWorkspace(db.prisma, {
      workspaceId,
      invitedById: adminId,
      email: "ana@test.dev",
      role: "MEMBER",
      adminEmails: ADMINS,
    });

    expect(result).toEqual({ ok: false, reason: "alreadyMember" });
  });

  it("stores the projects picked for the person, with their roles", async () => {
    const web = await createProject("Web");
    const app = await createProject("App");

    await invite("nuevo@test.dev", [
      { projectId: web.id, role: "TRACKER" },
      { projectId: app.id, role: "VIEWER" },
    ]);

    expect(await invitedProjects()).toEqual([
      { projectId: web.id, role: "TRACKER" },
      { projectId: app.id, role: "VIEWER" },
    ]);
  });

  it("skips archived projects and projects outside the workspace", async () => {
    const web = await createProject("Web");
    const old = await createProject("Old", { archivedAt: new Date() });
    const other = await db.prisma.workspace.create({ data: { name: "Other" } });
    const foreign = await createProject("Foreign", { workspaceId: other.id });

    await invite("nuevo@test.dev", [
      { projectId: web.id, role: "TRACKER" },
      { projectId: old.id, role: "TRACKER" },
      { projectId: foreign.id, role: "TRACKER" },
      { projectId: "missing", role: "VIEWER" },
    ]);

    expect(await invitedProjects()).toEqual([{ projectId: web.id, role: "TRACKER" }]);
  });

  it("replaces the projects when the same email is invited again", async () => {
    const web = await createProject("Web");
    const app = await createProject("App");

    await invite("nuevo@test.dev", [{ projectId: web.id, role: "TRACKER" }]);
    // A repeated project keeps the last role picked.
    await invite("nuevo@test.dev", [
      { projectId: app.id, role: "VIEWER" },
      { projectId: app.id, role: "TRACKER" },
    ]);

    expect(await invitedProjects()).toEqual([{ projectId: app.id, role: "TRACKER" }]);
  });

  it("puts someone who already asked for access straight into the projects", async () => {
    const web = await createProject("Web");
    const { user } = await requestAccess("carla@test.dev");

    await invite("carla@test.dev", [{ projectId: web.id, role: "VIEWER" }]);

    expect(
      await db.prisma.projectMember.findMany({ where: { userId: user.id }, select: { projectId: true, role: true } }),
    ).toEqual([{ projectId: web.id, role: "VIEWER" }]);
  });
});

describe("revokeInvitation", () => {
  it("deletes an open invitation", async () => {
    await inviteToWorkspace(db.prisma, {
      workspaceId,
      invitedById: adminId,
      email: "nuevo@test.dev",
      role: "MEMBER",
      adminEmails: ADMINS,
    });
    const invitation = await db.prisma.invitation.findFirstOrThrow();

    expect(await revokeInvitation(db.prisma, workspaceId, invitation.id)).toEqual({ ok: true });
    expect(await db.prisma.invitation.count()).toBe(0);
  });
});
