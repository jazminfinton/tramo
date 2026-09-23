import "server-only";

import { planAccess, type AccessStep } from "@/lib/access/plan";
import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeEmail } from "@/lib/email";

/** Name of the workspace the first bootstrap admin creates. Admins can rename it. */
export const DEFAULT_WORKSPACE_NAME = "Mi espacio";

// Every reconciliation takes this transaction-scoped advisory lock, so two
// simultaneous first sign-ins can't both create "the" first workspace.
const RECONCILE_LOCK = 72_106_001;

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Brings a person's memberships in line with the access rules in plan.ts.
 * Runs on every sign-in and is idempotent: reconciling twice changes nothing.
 */
export async function reconcileAccess(
  db: PrismaClient,
  user: { id: string; email: string },
  adminEmails: Set<string>,
): Promise<void> {
  const email = normalizeEmail(user.email);

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RECONCILE_LOCK})`;

    const defaultWorkspace = await tx.workspace.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const memberships = await tx.workspaceMember.findMany({
      where: { userId: user.id },
      select: { workspaceId: true, role: true, status: true },
    });
    const invitations = await tx.invitation.findMany({
      where: { email, acceptedAt: null },
      select: { id: true, workspaceId: true, role: true },
    });

    const steps = planAccess({
      isBootstrapAdmin: adminEmails.has(email),
      defaultWorkspaceId: defaultWorkspace?.id ?? null,
      memberships,
      invitations,
    });

    for (const step of steps) {
      await applyStep(tx, user.id, step);
    }
  });
}

async function applyStep(tx: Tx, userId: string, step: AccessStep): Promise<void> {
  switch (step.kind) {
    case "createWorkspaceAsAdmin":
      await tx.workspace.create({
        data: {
          name: DEFAULT_WORKSPACE_NAME,
          members: { create: { userId, role: "ADMIN", status: "ACTIVE" } },
        },
      });
      return;

    case "grantAdmin":
      await tx.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: step.workspaceId, userId } },
        create: { workspaceId: step.workspaceId, userId, role: "ADMIN", status: "ACTIVE" },
        update: { role: "ADMIN", status: "ACTIVE" },
      });
      return;

    case "acceptInvitation": {
      await tx.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: step.workspaceId, userId } },
        create: { workspaceId: step.workspaceId, userId, role: step.role, status: "ACTIVE" },
        update: { role: step.role, status: "ACTIVE" },
      });
      // The projects picked on the invitation, so the person lands straight in
      // them. Only here, once: accepting marks the invitation, and a later
      // sign-in never undoes what an admin changed on the board since.
      const projects = await tx.invitationProject.findMany({
        where: { invitationId: step.invitationId },
        select: { projectId: true, role: true },
      });
      for (const { projectId, role } of projects) {
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId, userId } },
          create: { projectId, userId, role },
          update: { role },
        });
      }
      await tx.invitation.update({
        where: { id: step.invitationId },
        data: { acceptedAt: new Date() },
      });
      return;
    }

    case "requestAccess":
      await tx.workspaceMember.create({
        data: { workspaceId: step.workspaceId, userId, role: "MEMBER", status: "PENDING" },
      });
      return;
  }
}
