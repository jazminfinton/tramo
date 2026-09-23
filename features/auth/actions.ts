"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { reconcileAccess } from "@/lib/access/onboarding";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { parseEmailList } from "@/lib/email";

export async function signOut() {
  // Deletes the session row; the nextCookies plugin clears the cookie.
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}

/**
 * From the pending page: turns a rejected request back into a pending one,
 * or, for someone who signed in before any workspace existed, runs the access
 * rules again (which files the request now that there is one).
 */
export async function requestAccessAgain() {
  const user = await requireUser();

  const reopened = await prisma.workspaceMember.updateMany({
    where: { userId: user.id, status: "REJECTED" },
    data: { status: "PENDING" },
  });

  if (reopened.count === 0) {
    await reconcileAccess(prisma, user, parseEmailList(process.env.ADMIN_EMAILS));
  }

  redirect("/pending");
}
