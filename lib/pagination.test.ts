import { describe, expect, it } from "vitest";

import { PAGE_SIZE, param, parsePageRequest, toPage } from "@/lib/pagination";

const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `r${index}` }));

describe("param", () => {
  it("reads one value that isn't empty", () => {
    expect(param({ q: "hola" }, "q")).toBe("hola");
  });

  it("ignores what's missing, empty or repeated", () => {
    expect(param({}, "q")).toBeUndefined();
    expect(param({ q: "" }, "q")).toBeUndefined();
    expect(param({ q: ["a", "b"] }, "q")).toBeUndefined();
  });
});

describe("parsePageRequest", () => {
  it("reads one direction at a time, and `after` wins", () => {
    expect(parsePageRequest({})).toEqual({});
    expect(parsePageRequest({ after: "a" })).toEqual({ after: "a" });
    expect(parsePageRequest({ before: "b" })).toEqual({ before: "b" });
    expect(parsePageRequest({ after: "a", before: "b" })).toEqual({ after: "a" });
  });
});

describe("toPage", () => {
  it("has nowhere to go with everything on the first page", () => {
    expect(toPage(rows(3), {})).toEqual({ items: rows(3), nextCursor: null, prevCursor: null });
  });

  it("trims the extra row, which says there's more", () => {
    const page = toPage(rows(PAGE_SIZE + 1), {});

    expect(page.items).toHaveLength(PAGE_SIZE);
    expect(page.nextCursor).toBe(`r${PAGE_SIZE - 1}`);
    expect(page.prevCursor).toBeNull();
  });

  it("can go back from a page reached going forward", () => {
    expect(toPage(rows(3), { after: "x" })).toEqual({ items: rows(3), nextCursor: null, prevCursor: "r0" });
  });

  it("finds the extra row first when walking back", () => {
    const page = toPage(rows(PAGE_SIZE + 1), { before: "x" });

    expect(page.items).toHaveLength(PAGE_SIZE);
    expect(page.items[0]?.id).toBe("r1");
    expect(page.prevCursor).toBe("r1");
    expect(page.nextCursor).toBe(`r${PAGE_SIZE}`);
  });

  it("has no earlier page once walking back reaches the start", () => {
    const page = toPage(rows(2), { before: "x" });

    expect(page.prevCursor).toBeNull();
    expect(page.nextCursor).toBe("r1");
  });
});
