import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { accessStatus, isAdmin, projectPersona } from "@/lib/access/permissions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * The data access layer: the ONLY place the app reads a session or decides
 * access. Pages call these at the top; never guard anything in a layout, since
 * layouts don't re-render on client-side navigation (the (app) layout only
 * reads the session to draw the header).
 */

/** One session read per request, from the cookie cache. For display only. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

/**
 * Where the signed-in person stands. Access decisions skip the cookie cache
 * and read the database, so an approval or a removal takes effect on the very
 * next request instead of up to five minutes later.
 */
export const getAccess = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session) return null;

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      status: true,
      workspace: { select: { id: true, name: true } },
    },
  });

  return {
    user: session.user,
    status: accessStatus(memberships.map((membership) => membership.status)),
    // The workspace the app shows. With several, the first one joined; a
    // switcher arrives once someone actually belongs to more than one.
    member: memberships.find((membership) => membership.status === "ACTIVE") ?? null,
  };
});

/** For workspace pages: no session → sign-in; not approved yet → pending page. */
export async function requireMember() {
  const access = await getAccess();
  if (!access) redirect("/sign-in");
  if (!access.member) redirect("/pending");

  return {
    user: access.user,
    member: access.member,
    workspace: access.member.workspace,
    isAdmin: isAdmin(access.member),
  };
}

/** For admin pages: anyone else gets a 404, so the area doesn't admit it exists. */
export async function requireAdmin() {
  const context = await requireMember();
  if (!context.isAdmin) notFound();
  return context;
}

/**
 * How this person takes part in the workspace's active projects: their persona
 * (tracker, observer, unassigned), which shapes the home, the week and the
 * tour, and the projects they observe. Once per request, whoever asks.
 */
export const getProjectAccess = cache(async (userId: string, workspaceId: string) => {
  const memberships = await prisma.projectMember.findMany({
    where: { userId, project: { workspaceId, archivedAt: null } },
    orderBy: { project: { name: "asc" } },
    select: { role: true, project: { select: { id: true, name: true, color: true } } },
  });
  return {
    persona: projectPersona(memberships.map((membership) => membership.role)),
    observed: memberships.filter((membership) => membership.role === "VIEWER").map((membership) => membership.project),
  };
});
