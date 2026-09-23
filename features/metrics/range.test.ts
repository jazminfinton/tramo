import { describe, expect, it } from "vitest";

import { METRIC_RANGES, resolveRange } from "@/features/metrics/range";

const AR = "America/Argentina/Buenos_Aires";
const now = new Date("2026-09-24T15:00:00Z"); // Thursday

describe("resolveRange", () => {
  it("offers three ranges", () => {
    expect(METRIC_RANGES).toEqual(["week", "4w", "12w"]);
  });

  it("covers the current week", () => {
    const range = resolveRange("week", AR, now);
    expect(range.key).toBe("week");
    expect(range.weeks).toEqual(["2026-09-21"]);
    expect(range.start.toISOString()).toBe("2026-09-21T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-28T03:00:00.000Z");
  });

  it("covers the current week and the ones before it", () => {
    const range = resolveRange("4w", AR, now);
    expect(range.weeks).toEqual(["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"]);
    expect(range.start.toISOString()).toBe("2026-08-31T03:00:00.000Z");
  });

  it("reads one week day by day", () => {
    const range = resolveRange("week", AR, now);
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

  it("reads longer ranges week by week", () => {
    const range = resolveRange("12w", AR, now);
    expect(range.unit).toBe("week");
    expect(range.buckets).toEqual(range.weeks);
    expect(range.buckets).toHaveLength(12);
  });

  it("falls back to four weeks for anything unknown", () => {
    expect(resolveRange("forever", AR, now).key).toBe("4w");
    expect(resolveRange(undefined, AR, now).key).toBe("4w");
  });
});
