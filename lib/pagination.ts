// Cursor (keyset) paging, as in Fragua: pages stay fast at any depth, and rows
// don't repeat or go missing when the data changes underneath.

export const PAGE_SIZE = 25;

export type SearchParams = Record<string, string | string[] | undefined>;

export type PageRequest = { after?: string; before?: string };

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
};

/** One text parameter that isn't empty. A repeated key (?a=1&a=2) counts as none. */
export function param(params: SearchParams, key: string) {
  const value = params[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** One direction at a time; with both in the URL, `after` wins. */
export function parsePageRequest(params: SearchParams): PageRequest {
  const after = param(params, "after");
  if (after) return { after };
  const before = param(params, "before");
  return before ? { before } : {};
}

/**
 * A page out of PAGE_SIZE + 1 rows in display order: the extra one says there's
 * more, so a list needs no count to know. It's the first row when walking back,
 * since that's the far end, and the last one otherwise.
 */
export function toPage<T extends { id: string }>(rows: T[], { after, before }: PageRequest): Page<T> {
  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? (before ? rows.slice(1) : rows.slice(0, PAGE_SIZE)) : rows;
  const first = items[0]?.id ?? null;
  const last = items.at(-1)?.id ?? null;

  return {
    items,
    nextCursor: before || hasMore ? last : null,
    prevCursor: before ? (hasMore ? first : null) : after ? first : null,
  };
}
