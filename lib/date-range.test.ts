import { describe, expect, it } from "vitest";

import { formatDayRange, isPickable, openingMonth, positionIn, rangeOf } from "@/lib/date-range";
import { toIsoDate } from "@/lib/dates";

describe("rangeOf", () => {
  it("puts two picked days in order, whichever came first", () => {
    expect(rangeOf("2026-09-01", "2026-09-30")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(rangeOf("2026-09-30", "2026-09-01")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("makes a one-day range of the same day twice", () => {
    expect(rangeOf("2026-09-23", "2026-09-23")).toEqual({ from: "2026-09-23", to: "2026-09-23" });
  });
});

describe("positionIn", () => {
  const september = { from: "2026-09-01", to: "2026-09-30" };

  it("tells the ends from the days between them", () => {
    expect(positionIn("2026-09-01", september)).toBe("start");
    expect(positionIn("2026-09-15", september)).toBe("inside");
    expect(positionIn("2026-09-30", september)).toBe("end");
  });

  it("leaves the days around it outside, across months and years", () => {
    expect(positionIn("2026-08-31", september)).toBe("outside");
    expect(positionIn("2026-10-01", september)).toBe("outside");
    expect(positionIn("2027-09-15", september)).toBe("outside");
  });

  it("calls the day of a one-day range its only one", () => {
    expect(positionIn("2026-09-23", { from: "2026-09-23", to: "2026-09-23" })).toBe("only");
  });

  it("finds nothing in no range", () => {
    expect(positionIn("2026-09-23", null)).toBe("outside");
  });
});

describe("isPickable", () => {
  it("lets any day be picked when there are no limits", () => {
    expect(isPickable("2031-01-01", {})).toBe(true);
  });

  it("stops at the last day allowed", () => {
    expect(isPickable("2026-09-24", { max: "2026-09-24" })).toBe(true);
    expect(isPickable("2026-09-25", { max: "2026-09-24" })).toBe(false);
  });

  it("keeps the second day within reach of the first, on either side", () => {
    const limits = { anchor: "2026-09-15", maxDays: 7 };

    expect(isPickable("2026-09-21", limits)).toBe(true); // a 7-day range
    expect(isPickable("2026-09-22", limits)).toBe(false);
    expect(isPickable("2026-09-09", limits)).toBe(true);
    expect(isPickable("2026-09-08", limits)).toBe(false);
  });

  it("only measures the reach once a first day is picked", () => {
    expect(isPickable("2020-01-01", { anchor: null, maxDays: 7 })).toBe(true);
  });
});

describe("formatDayRange", () => {
  it("writes both days the way dates are typed", () => {
    expect(formatDayRange({ from: "2026-09-01", to: "2026-09-30" })).toBe("01/09/2026 – 30/09/2026");
    expect(formatDayRange({ from: "2026-12-28", to: "2027-01-03" })).toBe("28/12/2026 – 03/01/2027");
  });

  it("writes a one-day range once", () => {
    expect(formatDayRange({ from: "2026-09-23", to: "2026-09-23" })).toBe("23/09/2026");
  });
});

describe("openingMonth", () => {
  const opens = (from: string, to: string, count: number, max?: string) =>
    toIsoDate(openingMonth({ from, to }, count, max));

  it("opens on the months the range is in", () => {
    expect(opens("2026-08-31", "2026-09-27", 2)).toBe("2026-08-01");
    expect(opens("2026-09-01", "2026-09-30", 2)).toBe("2026-09-01");
  });

  it("keeps the last day on show when the range is longer than the view", () => {
    expect(opens("2026-07-01", "2026-09-30", 2)).toBe("2026-08-01");
    expect(opens("2026-08-31", "2026-09-27", 1)).toBe("2026-09-01");
  });

  it("doesn't open on months nobody can pick from", () => {
    // This month alone: the month before goes next to it, not the one after.
    expect(opens("2026-10-01", "2026-10-07", 2, "2026-10-07")).toBe("2026-09-01");
    // A week that ends past the last day on offer, in the month after it.
    expect(opens("2026-09-28", "2026-10-04", 2, "2026-09-30")).toBe("2026-08-01");
    expect(opens("2026-09-28", "2026-10-04", 1, "2026-09-30")).toBe("2026-09-01");
  });

  it("leaves a past range where it is, with room after it", () => {
    expect(opens("2026-03-01", "2026-03-31", 2, "2026-10-07")).toBe("2026-03-01");
  });
});
