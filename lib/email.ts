/** Emails compare case-insensitively; store and match them in this form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Parses a comma-separated env value (e.g. ADMIN_EMAILS) into a set. */
export function parseEmailList(raw: string | undefined): Set<string> {
  if (!raw) return new Set();

  return new Set(
    raw
      .split(",")
      .map(normalizeEmail)
      .filter((email) => email.length > 0),
  );
}
