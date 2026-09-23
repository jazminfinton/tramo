import { describe, expect, it } from "vitest";

import { shiftIsoDate, weekRange, zonedDateKey, zonedInstant, zonedWeekStart } from "@/lib/zoned";

const AR = "America/Argentina/Buenos_Aires"; // UTC-3, no DST
const NY = "America/New_York"; // has DST

describe("zonedInstant", () => {
  it("turns a local date and time into the right instant", () => {
    expect(zonedInstant("2026-09-23", 14 * 60 + 30, AR).toISOString()).toBe("2026-09-23T17:30:00.000Z");
  });

  it("respects daylight saving time", () => {
    expect(zonedInstant("2026-07-01", 9 * 60, NY).toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedInstant("2026-12-01", 9 * 60, NY).toISOString()).toBe("2026-12-01T14:00:00.000Z");
  });
});

describe("zonedDateKey", () => {
  it("reads the calendar day in the person's zone, not in UTC", () => {
    // 01:30 UTC on the 24th is still the 23rd in Buenos Aires.
    expect(zonedDateKey(new Date("2026-09-24T01:30:00Z"), AR)).toBe("2026-09-23");
  });
});

describe("zonedWeekStart", () => {
  it("returns the Monday of that week", () => {
    expect(zonedWeekStart(new Date("2026-09-23T15:00:00Z"), AR)).toBe("2026-09-21");
  });

  it("uses the local day at the edge of Sunday night", () => {
    // Monday 02:00 UTC is Sunday 23:00 in Buenos Aires: previous week.
    expect(zonedWeekStart(new Date("2026-09-21T02:00:00Z"), AR)).toBe("2026-09-14");
  });
});

describe("weekRange", () => {
  it("spans Monday 00:00 to next Monday 00:00, local time", () => {
    const range = weekRange("2026-09-21", AR);
    expect(range.start.toISOString()).toBe("2026-09-21T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-28T03:00:00.000Z");
    expect(range.days).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("lasts 169 hours on the week clocks go back", () => {
    const range = weekRange("2026-10-26", NY); // DST ends Sunday Nov 1
    expect((range.end.getTime() - range.start.getTime()) / 3_600_000).toBe(169);
  });
});

describe("shiftIsoDate", () => {
  it("moves calendar days across months and years", () => {
    expect(shiftIsoDate("2026-12-28", 7)).toBe("2027-01-04");
    expect(shiftIsoDate("2026-03-02", -7)).toBe("2026-02-23");
  });
});
