import type { MemberStatus, ProjectRole, WorkspaceRole } from "@/generated/prisma/enums";

/**
 * What each role may do. Roles are data (stored per membership); these rules
 * are code, so they are reviewed and tested like any other logic. Every access
 * decision in the app goes through these helpers, via the DAL.
 */

type Member = { role: WorkspaceRole; status: MemberStatus };

export function isAdmin(member: Member): boolean {
  return member.status === "ACTIVE" && member.role === "ADMIN";
}

/** Logging time requires the TRACKER role on that project. */
export function canTrack(projectRole: ProjectRole | null): boolean {
  return projectRole === "TRACKER";
}

/**
 * Transparency per project: anyone assigned to a project (tracker or viewer)
 * sees everyone's hours in it. Admins see every project.
 */
export function canViewProject(member: Member, projectRole: ProjectRole | null): boolean {
  if (member.status !== "ACTIVE") return false;
  return member.role === "ADMIN" || projectRole !== null;
}

export type ProjectPersona = "tracker" | "observer" | "unassigned";

/**
 * How someone takes part in a workspace's projects, which shapes their home,
 * their week and their tour: a tracker logs time in at least one project; an
 * observer only reads (VIEWER everywhere); unassigned means no project yet.
 */
export function projectPersona(roles: ProjectRole[]): ProjectPersona {
  if (roles.includes("TRACKER")) return "tracker";
  return roles.length > 0 ? "observer" : "unassigned";
}

/**
 * The projects someone may see, as a Prisma filter: the same transparency per
 * project as canViewProject, for queries. Admins get every project of the
 * workspace; everyone else, the ones they belong to in any role.
 */
export function visibleProjectsWhere(input: { workspaceId: string; userId: string; isAdmin: boolean }) {
  return input.isAdmin
    ? { workspaceId: input.workspaceId }
    : { workspaceId: input.workspaceId, members: { some: { userId: input.userId } } };
}

export type AccessStatus = "active" | "pending" | "rejected" | "none";

/** One word for where a person stands, across all their memberships. */
export function accessStatus(statuses: MemberStatus[]): AccessStatus {
  if (statuses.includes("ACTIVE")) return "active";
  if (statuses.includes("PENDING")) return "pending";
  if (statuses.includes("REJECTED")) return "rejected";
  return "none";
}
