import { describe, expect, it } from "vitest";

import { normalizeEmail, parseEmailList } from "@/lib/email";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ana.Perez@Gmail.COM ")).toBe("ana.perez@gmail.com");
  });
});

describe("parseEmailList", () => {
  it("parses a comma-separated list into normalized emails", () => {
    expect(parseEmailList("a@x.com, B@X.com ,c@x.com")).toEqual(
      new Set(["a@x.com", "b@x.com", "c@x.com"]),
    );
  });

  it("drops empty entries and duplicates", () => {
    expect(parseEmailList("a@x.com,, ,A@x.com")).toEqual(new Set(["a@x.com"]));
  });

  it("returns an empty set when the variable is missing", () => {
    expect(parseEmailList(undefined)).toEqual(new Set());
    expect(parseEmailList("")).toEqual(new Set());
  });
});
