import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { ProjectRole, WorkspaceRole } from "@/generated/prisma/enums";
import { reconcileAccess } from "@/lib/access/onboarding";
import { normalizeEmail } from "@/lib/email";

/**
 * Workspace membership operations, used by the admin Server Actions. They take
 * the database as a parameter so they're tested against real Postgres
 * (members.test.ts). Authorization happens before: callers are admins of
 * `workspaceId`, checked by the DAL. Every query is still scoped to that
 * workspace, so an id from another workspace is simply "not found".
 */

export type MemberResult =
  | { ok: true }
  | { ok: false; reason: "notFound" | "self" | "lastAdmin" | "alreadyMember" };

const ok: MemberResult = { ok: true };
const fail = (reason: Extract<MemberResult, { ok: false }>["reason"]): MemberResult => ({
  ok: false,
  reason,
});

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// Role and status changes for one workspace run one at a time, so two admins
// demoting each other at the same moment can't leave the workspace without one.
async function lockWorkspace(tx: Tx, workspaceId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`;
}

async function isLastActiveAdmin(tx: Tx, workspaceId: string) {
  const admins = await tx.workspaceMember.count({
    where: { workspaceId, role: "ADMIN", status: "ACTIVE" },
  });
  return admins <= 1;
}

export async function approveMember(
  db: PrismaClient,
  workspaceId: string,
  memberId: string,
): Promise<MemberResult> {
  const { count } = await db.workspaceMember.updateMany({
    where: { id: memberId, workspaceId, status: { in: ["PENDING", "REJECTED"] } },
    data: { status: "ACTIVE" },
  });
  return count === 1 ? ok : fail("notFound");
}

export async function rejectMember(
  db: PrismaClient,
  workspaceId: string,
  memberId: string,
  actingUserId: string,
): Promise<MemberResult> {
  return db.$transaction(async (tx) => {
    await lockWorkspace(tx, workspaceId);

    const member = await tx.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
    if (!member) return fail("notFound");
    if (member.userId === actingUserId) return fail("self");
    if (member.role === "ADMIN" && member.status === "ACTIVE" && (await isLastActiveAdmin(tx, workspaceId))) {
      return fail("lastAdmin");
    }

    await tx.workspaceMember.update({ where: { id: memberId }, data: { status: "REJECTED" } });
    return ok;
  });
}

export async function setMemberRole(
  db: PrismaClient,
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole,
): Promise<MemberResult> {
  return db.$transaction(async (tx) => {
    await lockWorkspace(tx, workspaceId);

    const member = await tx.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
    if (!member) return fail("notFound");

    const demotesAnAdmin = member.role === "ADMIN" && role !== "ADMIN" && member.status === "ACTIVE";
    if (demotesAnAdmin && (await isLastActiveAdmin(tx, workspaceId))) return fail("lastAdmin");

    await tx.workspaceMember.update({ where: { id: memberId }, data: { role } });
    return ok;
  });
}

/**
 * Pre-approves a Google email, optionally with the projects the person joins
 * and their role on each. If that person already signed in (typically with a
 * pending request), their access is reconciled right away instead of waiting
 * for their next sign-in.
 *
 * Inviting the same email again replaces the invitation, projects included.
 * Projects that are archived or belong to another workspace are skipped.
 */
export async function inviteToWorkspace(
  db: PrismaClient,
  input: {
    workspaceId: string;
    invitedById: string;
    email: string;
    role: WorkspaceRole;
    adminEmails: Set<string>;
    projects?: { projectId: string; role: ProjectRole }[];
  },
): Promise<MemberResult> {
  const email = normalizeEmail(input.email);

  const activeMember = await db.workspaceMember.findFirst({
    where: { workspaceId: input.workspaceId, status: "ACTIVE", user: { email } },
    select: { id: true },
  });
  if (activeMember) return fail("alreadyMember");

  // One role per project: when a project repeats, the last pick wins.
  const picked = new Map((input.projects ?? []).map(({ projectId, role }) => [projectId, role]));
  const assignable = await db.project.findMany({
    where: { id: { in: [...picked.keys()] }, workspaceId: input.workspaceId, archivedAt: null },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    const invitation = await tx.invitation.upsert({
      where: { workspaceId_email: { workspaceId: input.workspaceId, email } },
      create: { workspaceId: input.workspaceId, email, role: input.role, invitedById: input.invitedById },
      update: { role: input.role, invitedById: input.invitedById, acceptedAt: null },
      select: { id: true },
    });
    await tx.invitationProject.deleteMany({ where: { invitationId: invitation.id } });
    await tx.invitationProject.createMany({
      data: assignable.map(({ id }) => ({ invitationId: invitation.id, projectId: id, role: picked.get(id) })),
    });
  });

  const existingUser = await db.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (existingUser) await reconcileAccess(db, existingUser, input.adminEmails);

  return ok;
}

export async function revokeInvitation(
  db: PrismaClient,
  workspaceId: string,
  invitationId: string,
): Promise<MemberResult> {
  const { count } = await db.invitation.deleteMany({
    where: { id: invitationId, workspaceId, acceptedAt: null },
  });
  return count === 1 ? ok : fail("notFound");
}
