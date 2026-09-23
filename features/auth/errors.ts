/**
 * Maps the `?error=` code a failed sign-in comes back with to a message key.
 * The code comes from the URL, so anyone can put anything there: known codes
 * get a specific message, everything else a generic one, and the raw value is
 * never shown.
 */
export type SignInErrorKey = "cancelled" | "generic";

const KNOWN = new Map<string, SignInErrorKey>([["access_denied", "cancelled"]]);

export function signInErrorKey(code: string | undefined): SignInErrorKey | null {
  if (!code) return null;
  return KNOWN.get(code) ?? "generic";
}
