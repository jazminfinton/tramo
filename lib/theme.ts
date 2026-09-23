/**
 * Theme catalog and resolution.
 *
 * A theme is a palette plus a mode. Both travel as attributes on <html>
 * (`data-palette`, `data-theme`) and are read by app/globals.css. The stored
 * choice arrives from cookies, which are user-controlled input, so every value
 * is validated here and falls back to the default on its own.
 */

/** In hue order, as the picker shows them, with the grey one last. */
export const PALETTES = ["lima", "salvia", "cielo", "indigo", "orquidea", "coral", "ambar", "grafito"] as const;
export const MODES = ["dark", "light"] as const;

export type Palette = (typeof PALETTES)[number];
export type Mode = (typeof MODES)[number];
export type Theme = { palette: Palette; mode: Mode };

export const DEFAULT_THEME: Theme = { palette: "lima", mode: "dark" };

export const THEME_COOKIES = { palette: "palette", mode: "mode" } as const;

/**
 * Each theme's accent and the color that reads on it, for what's drawn
 * outside CSS: the favicon. A copy of app/globals.css, kept honest by a test.
 */
export const THEME_ACCENTS: Record<Palette, Record<Mode, { accent: string; onAccent: string }>> = {
  lima: { dark: { accent: "#c5ef5a", onAccent: "#171a0c" }, light: { accent: "#44710b", onAccent: "#ffffff" } },
  salvia: { dark: { accent: "#5ee0a0", onAccent: "#0c1510" }, light: { accent: "#19754e", onAccent: "#ffffff" } },
  cielo: { dark: { accent: "#62caff", onAccent: "#041824" }, light: { accent: "#0068a7", onAccent: "#ffffff" } },
  indigo: { dark: { accent: "#9092ff", onAccent: "#13132a" }, light: { accent: "#4b44d6", onAccent: "#ffffff" } },
  orquidea: { dark: { accent: "#f187d0", onAccent: "#20101a" }, light: { accent: "#a32a7a", onAccent: "#ffffff" } },
  coral: { dark: { accent: "#ff7f6c", onAccent: "#23100d" }, light: { accent: "#b6341f", onAccent: "#ffffff" } },
  ambar: { dark: { accent: "#ffb547", onAccent: "#1c1405" }, light: { accent: "#95560a", onAccent: "#ffffff" } },
  grafito: { dark: { accent: "#d4d4d4", onAccent: "#161616" }, light: { accent: "#333333", onAccent: "#ffffff" } },
};

/**
 * Bump when the favicon's drawing changes. Browsers keep it for a year (it's
 * served as immutable), so only a new URL makes them fetch the new one.
 */
export const BRAND_ICON_VERSION = 2;

/** The favicon drawn for a theme (app/brand-icon/[theme]/route.ts). */
export function brandIconHref(theme: Theme) {
  return `/brand-icon/${theme.palette}-${theme.mode}?v=${BRAND_ICON_VERSION}`;
}

/** One year: the preference should outlive any session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isPalette(value: unknown): value is Palette {
  return typeof value === "string" && (PALETTES as readonly string[]).includes(value);
}

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

type StoredTheme = { palette?: string | null; mode?: string | null };

/**
 * This browser's cookies win; the account's saved preference fills in on a
 * device that has none yet; the default covers the rest. Each field on its
 * own, and anything outside the catalog is ignored.
 */
export function resolveTheme(cookies: StoredTheme, account: StoredTheme = {}): Theme {
  const pick = <T>(check: (value: unknown) => value is T, ...candidates: unknown[]) =>
    candidates.find((candidate): candidate is T => check(candidate));

  return {
    palette: pick(isPalette, cookies.palette, account.palette) ?? DEFAULT_THEME.palette,
    mode: pick(isMode, cookies.mode, account.mode) ?? DEFAULT_THEME.mode,
  };
}
