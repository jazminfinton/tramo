import type { MemberStatus, WorkspaceRole } from "@/generated/prisma/enums";

/**
 * Who gets into which workspace, decided on every sign-in.
 *
 * Pure on purpose: it takes a snapshot of the person's situation and returns
 * the steps to apply. `reconcileAccess` (onboarding.ts) reads the snapshot and
 * applies the steps in one transaction. Running it on every sign-in, not only
 * the first, is what lets an invitation or an ADMIN_EMAILS change made after
 * someone's first visit take effect on their next one.
 *
 * Rules:
 * 1. Bootstrap admins (ADMIN_EMAILS) are always active admins of the default
 *    workspace, creating it if none exists yet.
 * 2. Open invitations are accepted: the member becomes ACTIVE with the invited
 *    role — even after a rejection, since an admin chose to invite them — and
 *    an admin is never downgraded by one.
 * 3. Anyone with no membership and no invitation requests access to the
 *    default workspace (PENDING, which grants nothing until approved).
 */

export type MembershipSnapshot = {
  workspaceId: string;
  role: WorkspaceRole;
  status: MemberStatus;
};

export type InvitationSnapshot = {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
};

export type AccessState = {
  isBootstrapAdmin: boolean;
  /** The oldest workspace, where access requests go. Null before the first one exists. */
  defaultWorkspaceId: string | null;
  memberships: MembershipSnapshot[];
  /** Invitations for this person's email that haven't been accepted yet. */
  invitations: InvitationSnapshot[];
};

export type AccessStep =
  | { kind: "createWorkspaceAsAdmin" }
  | { kind: "grantAdmin"; workspaceId: string }
  | { kind: "acceptInvitation"; invitationId: string; workspaceId: string; role: WorkspaceRole }
  | { kind: "requestAccess"; workspaceId: string };

export function planAccess(state: AccessState): AccessStep[] {
  const steps: AccessStep[] = [];
  const membershipIn = (workspaceId: string) =>
    state.memberships.find((membership) => membership.workspaceId === workspaceId);

  if (state.isBootstrapAdmin) {
    if (state.defaultWorkspaceId === null) {
      steps.push({ kind: "createWorkspaceAsAdmin" });
    } else {
      const current = membershipIn(state.defaultWorkspaceId);
      if (current?.role !== "ADMIN" || current.status !== "ACTIVE") {
        steps.push({ kind: "grantAdmin", workspaceId: state.defaultWorkspaceId });
      }
    }
  }

  for (const invitation of state.invitations) {
    const current = membershipIn(invitation.workspaceId);
    steps.push({
      kind: "acceptInvitation",
      invitationId: invitation.id,
      workspaceId: invitation.workspaceId,
      role: current?.role === "ADMIN" ? "ADMIN" : invitation.role,
    });
  }

  const hasAnything = state.memberships.length > 0 || steps.length > 0;
  if (!hasAnything && state.defaultWorkspaceId !== null) {
    steps.push({ kind: "requestAccess", workspaceId: state.defaultWorkspaceId });
  }

  return steps;
}
