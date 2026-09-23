/**
 * The key every text search compares on: no accents, no case, single spaces.
 * So "reunion" finds "Reunión" and "INDIGO" finds "Índigo" (as in Fragua).
 */
export function toSearchKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Type-ahead for a list: the first option whose label, or one of its keywords,
 * starts with what was typed (compared as search keys). -1 when none does.
 */
export function typeaheadIndex(options: readonly { label: string; keywords?: readonly string[] }[], typed: string) {
  const key = toSearchKey(typed);
  if (!key) return -1;
  return options.findIndex((option) =>
    [option.label, ...(option.keywords ?? [])].some((text) => toSearchKey(text).startsWith(key)),
  );
}
