/**
 * The app runs in a single locale for now, without locale-prefixed routes.
 * All UI copy lives in messages/<locale>.json, so adding a language later means
 * adding a file and enabling next-intl's routing, not rewriting components.
 */
export const LOCALE = "es-AR";

/** Fallback for formatting until each user's own time zone is stored. */
export const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";
