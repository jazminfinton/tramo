"use server";

import { cookies } from "next/headers";

import { getSession } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { THEME_COOKIES, THEME_COOKIE_MAX_AGE, isMode, isPalette } from "@/lib/theme";

/**
 * Stores the theme choice: in this browser's cookies (so the server renders it
 * without a flash) and, when signed in, in the account (so it follows the
 * person to other devices). The arguments come from the client, so anything
 * outside the catalog is ignored rather than written.
 */
export async function saveTheme(palette: string, mode: string): Promise<void> {
  if (!isPalette(palette) || !isMode(mode)) return;

  const store = await cookies();
  const options = {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  } as const;
  store.set(THEME_COOKIES.palette, palette, options);
  store.set(THEME_COOKIES.mode, mode, options);

  const session = await getSession();
  if (session) {
    await prisma.user.update({ where: { id: session.user.id }, data: { palette, themeMode: mode } });
  }
}
