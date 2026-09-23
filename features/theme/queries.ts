import "server-only";

import { cookies } from "next/headers";

import { getSession } from "@/lib/dal";
import { THEME_COOKIES, resolveTheme, type Theme } from "@/lib/theme";

/**
 * The theme to render, read on the server so <html> arrives with the right
 * attributes and there is no flash on first paint. This browser's cookies win;
 * on a device without them, the preference saved in the account (carried in
 * the session, no extra query) fills in.
 */
export async function getStoredTheme(): Promise<Theme> {
  const [store, session] = await Promise.all([cookies(), getSession()]);

  return resolveTheme(
    { palette: store.get(THEME_COOKIES.palette)?.value, mode: store.get(THEME_COOKIES.mode)?.value },
    { palette: session?.user.palette, mode: session?.user.themeMode },
  );
}
