import { describe, expect, it } from "vitest";

import { MAX_RANGE_DAYS, METRIC_RANGES, resolveRange } from "@/features/metrics/range";

const AR = "America/Argentina/Buenos_Aires";
const now = new Date("2026-09-24T15:00:00Z"); // Thursday

const preset = (range?: string) => resolveRange({ range }, AR, now);
const picked = (from: string, to: string) => resolveRange({ from, to }, AR, now);

describe("resolveRange: the presets", () => {
  it("offers three of them", () => {
    expect(METRIC_RANGES).toEqual(["week", "4w", "12w"]);
  });

  it("covers the current week", () => {
    const range = preset("week");
    expect(range).toMatchObject({ key: "week", from: "2026-09-21", to: "2026-09-27" });
    expect(range.start.toISOString()).toBe("2026-09-21T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-28T03:00:00.000Z");
  });

  it("covers the current week and the ones before it", () => {
    const range = preset("4w");
    expect(range).toMatchObject({ from: "2026-08-31", to: "2026-09-27" });
    expect(range.start.toISOString()).toBe("2026-08-31T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-28T03:00:00.000Z");
  });

  it("reads one week day by day", () => {
    const range = preset("week");
    expect(range.unit).toBe("day");
    expect(range.buckets).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("reads longer ones week by week", () => {
    expect(preset("4w")).toMatchObject({
      unit: "week",
      buckets: ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"],
    });
    expect(preset("12w").buckets).toHaveLength(12);
  });

  it("falls back to four weeks for anything unknown", () => {
    expect(preset("forever").key).toBe("4w");
    expect(preset().key).toBe("4w");
    expect(resolveRange({ range: ["week", "12w"] }, AR, now).key).toBe("4w");
  });
});

describe("resolveRange: days picked by hand", () => {
  it("covers both days whole, on the viewer's clock", () => {
    const range = picked("2026-09-01", "2026-09-30");

    expect(range).toMatchObject({ key: "custom", from: "2026-09-01", to: "2026-09-30" });
    expect(range.start.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("wins over a preset named in the same URL", () => {
    expect(resolveRange({ range: "week", from: "2026-09-01", to: "2026-09-30" }, AR, now).key).toBe("custom");
  });

  it("reads up to a month day by day", () => {
    const month = picked("2026-08-01", "2026-08-31");

    expect(month.unit).toBe("day");
    expect(month.buckets).toHaveLength(31);
    expect(month.buckets[0]).toBe("2026-08-01");
    expect(month.buckets.at(-1)).toBe("2026-08-31");
  });

  it("reads longer ones week by week, starting with the week of its first day", () => {
    // Wednesday to Wednesday, 50 days.
    const range = picked("2026-08-05", "2026-09-23");

    expect(range.unit).toBe("week");
    expect(range.buckets).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
    ]);
    // The first week is cut where the range begins, not at its Monday.
    expect(range.start.toISOString()).toBe("2026-08-05T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-24T03:00:00.000Z");
  });

  it("takes a single day", () => {
    expect(picked("2026-09-23", "2026-09-23")).toMatchObject({
      key: "custom",
      unit: "day",
      buckets: ["2026-09-23"],
    });
  });

  it("takes a year at most", () => {
    expect(MAX_RANGE_DAYS).toBe(366);
    expect(picked("2026-01-01", "2027-01-01").key).toBe("custom"); // 366 days
    expect(picked("2026-01-01", "2027-01-02").key).toBe("4w");
  });

  it("falls back to the preset when the days don't make a range", () => {
    expect(picked("2026-09-30", "2026-09-01").key).toBe("4w");
    expect(picked("2026-02-30", "2026-03-05").key).toBe("4w");
    expect(picked("ayer", "hoy").key).toBe("4w");
    expect(resolveRange({ from: "2026-09-01" }, AR, now).key).toBe("4w");
    expect(resolveRange({ from: ["2026-09-01", "2026-09-02"], to: "2026-09-30" }, AR, now).key).toBe("4w");
    expect(resolveRange({ range: "week", from: "2026-09-30", to: "2026-09-01" }, AR, now).key).toBe("week");
  });
});
