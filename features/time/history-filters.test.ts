import { describe, expect, it } from "vitest";

import { hasFilters, historyQuery, NO_FILTERS, parseHistoryFilters, tidySearch } from "@/features/time/history-filters";

describe("parseHistoryFilters", () => {
  it("has no filters when the URL has none", () => {
    expect(parseHistoryFilters({})).toEqual(NO_FILTERS);
  });

  it("reads every filter", () => {
    expect(
      parseHistoryFilters({ person: "u1", from: "2026-09-01", to: "2026-09-30", q: "landing", task: "t1" }),
    ).toEqual({ person: "u1", from: "2026-09-01", to: "2026-09-30", text: "landing", task: "t1" });
  });

  it("takes both days or none: half a range, or one out of order, isn't a range", () => {
    const none = { from: null, to: null };

    expect(parseHistoryFilters({ from: "2026-09-01" })).toMatchObject(none);
    expect(parseHistoryFilters({ to: "2026-09-01" })).toMatchObject(none);
    expect(parseHistoryFilters({ from: "2026-09-30", to: "2026-09-01" })).toMatchObject(none);
    expect(parseHistoryFilters({ from: "ayer", to: "2026-09-01" })).toMatchObject(none);
    expect(parseHistoryFilters({ from: "2026-02-30", to: "2026-03-01" })).toMatchObject(none);
  });

  it("takes a one-day range", () => {
    expect(parseHistoryFilters({ from: "2026-09-01", to: "2026-09-01" })).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-01",
    });
  });

  it("ignores what can't be an id, and repeated values", () => {
    expect(parseHistoryFilters({ person: "u".repeat(65), task: ["a", "b"] })).toEqual(NO_FILTERS);
  });

  it("tidies the text and cuts what's absurdly long", () => {
    expect(parseHistoryFilters({ q: "  una   tarea " }).text).toBe("una tarea");
    expect(parseHistoryFilters({ q: "   " }).text).toBe("");
    expect(parseHistoryFilters({ q: "a".repeat(500) }).text).toHaveLength(200);
  });
});

describe("tidySearch", () => {
  it("leaves one space between words and none around them", () => {
    expect(tidySearch("  a \t b\n")).toBe("a b");
  });
});

describe("hasFilters", () => {
  it("tells whether any filter is on", () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, person: "u1" })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, from: "2026-09-01", to: "2026-09-02" })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, text: "a" })).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, task: "t1" })).toBe(true);
  });
});

describe("historyQuery", () => {
  it("stays on the tab, with only the filters that are on", () => {
    expect(historyQuery(NO_FILTERS)).toBe("tab=history");
    expect(historyQuery({ ...NO_FILTERS, text: "café con leche", task: "t1" })).toBe(
      "tab=history&q=caf%C3%A9+con+leche&task=t1",
    );
  });

  it("carries the page only when it's asked to: a new filter starts over", () => {
    const filters = { ...NO_FILTERS, person: "u1" };

    expect(historyQuery(filters, { after: "e9" })).toBe("tab=history&person=u1&after=e9");
    expect(historyQuery(filters, { before: "e1" })).toBe("tab=history&person=u1&before=e1");
  });

  it("is read back as the same filters", () => {
    const filters = { person: "u1", from: "2026-09-01", to: "2026-09-30", text: "una tarea", task: "t1" };

    expect(parseHistoryFilters(Object.fromEntries(new URLSearchParams(historyQuery(filters))))).toEqual(filters);
  });
});
