import { DESCRIPTION_MAX } from "@/features/time/schema";
import { param, type PageRequest, type SearchParams } from "@/lib/pagination";
import { isIsoDate } from "@/lib/zoned";

// What the history's filters decide, apart from how they're drawn: the URL is
// their source of truth, so a view can be shared and the server renders it. Each
// parameter is untrusted input, and anything that doesn't read as a filter is no
// filter at all.

export type HistoryFilters = {
  person: string | null;
  from: string | null;
  to: string | null;
  /** Looked for in what's written by hand on each block. */
  text: string;
  /** A team task. */
  task: string | null;
};

export const NO_FILTERS: HistoryFilters = { person: null, from: null, to: null, text: "", task: null };

/** What's typed, as it's searched: one space between words and none around them. */
export const tidySearch = (value: string) => value.replace(/\s+/g, " ").trim();

function idParam(params: SearchParams, key: string) {
  const value = param(params, key);
  return value && value.length <= 64 ? value : null;
}

export function parseHistoryFilters(params: SearchParams): HistoryFilters {
  const from = param(params, "from");
  const to = param(params, "to");
  const isRange = isIsoDate(from) && isIsoDate(to) && from <= to;

  return {
    person: idParam(params, "person"),
    from: isRange ? from : null,
    to: isRange ? to : null,
    text: tidySearch(param(params, "q") ?? "").slice(0, DESCRIPTION_MAX),
    task: idParam(params, "task"),
  };
}

export const hasFilters = ({ person, from, text, task }: HistoryFilters) =>
  person !== null || from !== null || text !== "" || task !== null;

/**
 * A view's place in the URL: the tab and the filters that are on. A page belongs
 * to one set of filters, so it only travels when it's asked for, and a new filter
 * starts over from the first one.
 */
export function historyQuery(filters: HistoryFilters, page: PageRequest = {}): string {
  const params = new URLSearchParams({ tab: "history" });
  if (filters.person) params.set("person", filters.person);
  if (filters.from && filters.to) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }
  if (filters.text) params.set("q", filters.text);
  if (filters.task) params.set("task", filters.task);
  if (page.after) params.set("after", page.after);
  if (page.before) params.set("before", page.before);
  return params.toString();
}
