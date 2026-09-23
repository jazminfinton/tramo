"use server";

import { refresh } from "next/cache";

import {
  approveMember,
  inviteToWorkspace,
  rejectMember,
  revokeInvitation,
  setMemberRole,
  type MemberResult,
} from "@/features/members/members";
import { inviteFromForm, inviteSchema, workspaceRoleSchema } from "@/features/members/schema";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { parseEmailList } from "@/lib/email";
import { parse, type ActionResult } from "@/lib/form";

// Every action starts with its access check: Server Actions are public POST
// endpoints, and hiding a button protects nothing. Arguments are untrusted;
// the domain functions scope every query to the admin's own workspace.

function settle(result: MemberResult): ActionResult {
  if (!result.ok) return { error: result.reason };
  refresh();
  return { ok: true };
}

export async function approveMemberAction(memberId: string): Promise<ActionResult> {
  const { workspace } = await requireAdmin();
  return settle(await approveMember(prisma, workspace.id, String(memberId)));
}

export async function rejectMemberAction(memberId: string): Promise<ActionResult> {
  const { workspace, user } = await requireAdmin();
  return settle(await rejectMember(prisma, workspace.id, String(memberId), user.id));
}

export async function setMemberRoleAction(memberId: string, role: string): Promise<ActionResult> {
  const { workspace } = await requireAdmin();
  const parsed = workspaceRoleSchema.safeParse(role);
  if (!parsed.success) return { error: "invalidRole" };
  return settle(await setMemberRole(prisma, workspace.id, String(memberId), parsed.data));
}

export async function inviteMemberAction(formData: FormData): Promise<ActionResult> {
  const { workspace, user } = await requireAdmin();
  const parsed = parse(inviteSchema, inviteFromForm(formData));
  if (!parsed.ok) return parsed.result;

  const result = await inviteToWorkspace(prisma, {
    workspaceId: workspace.id,
    invitedById: user.id,
    email: parsed.data.email,
    role: parsed.data.role,
    projects: parsed.data.projects,
    adminEmails: parseEmailList(process.env.ADMIN_EMAILS),
  });
  // The only expected failure belongs to the email field.
  if (!result.ok) return { fieldErrors: { email: result.reason } };

  refresh();
  return { ok: true };
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult> {
  const { workspace } = await requireAdmin();
  return settle(await revokeInvitation(prisma, workspace.id, String(invitationId)));
}
