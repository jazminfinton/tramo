import { describe, expect, it } from "vitest";

import {
  addMonths,
  calendarKeyTarget,
  formatDateInput,
  fromIsoDate,
  isSameDay,
  monthGrid,
  monthsShowing,
  parseDateInput,
  toIsoDate,
} from "@/lib/dates";

const day = (isoDate: string) => fromIsoDate(isoDate)!;

describe("parseDateInput", () => {
  it("reads dd/mm/yyyy with any separator and optional zeros", () => {
    expect(toIsoDate(parseDateInput("23/09/2026")!)).toBe("2026-09-23");
    expect(toIsoDate(parseDateInput("3-9-2026")!)).toBe("2026-09-03");
    expect(toIsoDate(parseDateInput("3.9.2026")!)).toBe("2026-09-03");
  });

  it("rejects impossible days instead of overflowing", () => {
    expect(parseDateInput("31/02/2026")).toBeNull();
    expect(parseDateInput("00/01/2026")).toBeNull();
  });

  it("requires a full year", () => {
    expect(parseDateInput("23/09/26")).toBeNull();
  });
});

describe("ISO round trip", () => {
  it("converts both ways", () => {
    expect(toIsoDate(fromIsoDate("2026-12-31")!)).toBe("2026-12-31");
    expect(fromIsoDate("2026-13-01")).toBeNull();
    expect(formatDateInput(fromIsoDate("2026-01-05")!)).toBe("05/01/2026");
  });
});

describe("addMonths", () => {
  it("clamps to the last day of shorter months", () => {
    expect(toIsoDate(addMonths(fromIsoDate("2026-01-31")!, 1))).toBe("2026-02-28");
    expect(toIsoDate(addMonths(fromIsoDate("2026-03-15")!, -3))).toBe("2025-12-15");
  });
});

describe("monthGrid", () => {
  it("always returns six Monday-first weeks", () => {
    const grid = monthGrid(2026, 8); // September 2026 starts on a Tuesday
    expect(grid).toHaveLength(42);
    expect(toIsoDate(grid[0]!)).toBe("2026-08-31");
    expect(isSameDay(grid[1]!, fromIsoDate("2026-09-01")!)).toBe(true);
  });
});

describe("calendarKeyTarget", () => {
  const target = (from: string, key: string, shiftKey = false) => {
    const next = calendarKeyTarget(day(from), key, shiftKey);
    return next && toIsoDate(next);
  };

  it("moves a day with the side arrows and a week with the other two", () => {
    expect(target("2026-09-23", "ArrowLeft")).toBe("2026-09-22");
    expect(target("2026-09-23", "ArrowRight")).toBe("2026-09-24");
    expect(target("2026-09-23", "ArrowUp")).toBe("2026-09-16");
    expect(target("2026-09-23", "ArrowDown")).toBe("2026-09-30");
  });

  it("walks out of the month", () => {
    expect(target("2026-09-30", "ArrowRight")).toBe("2026-10-01");
    expect(target("2026-01-03", "ArrowUp")).toBe("2025-12-27");
  });

  it("jumps to the ends of the week, Monday first", () => {
    expect(target("2026-09-23", "Home")).toBe("2026-09-21");
    expect(target("2026-09-23", "End")).toBe("2026-09-27");
    expect(target("2026-09-21", "Home")).toBe("2026-09-21");
    expect(target("2026-09-27", "End")).toBe("2026-09-27");
  });

  it("turns the page by a month, or by a year with Shift", () => {
    expect(target("2026-09-23", "PageUp")).toBe("2026-08-23");
    expect(target("2026-01-31", "PageDown")).toBe("2026-02-28");
    expect(target("2026-09-23", "PageUp", true)).toBe("2025-09-23");
    expect(target("2026-09-23", "PageDown", true)).toBe("2027-09-23");
  });

  it("leaves every other key alone", () => {
    expect(target("2026-09-23", "Enter")).toBeNull();
    expect(target("2026-09-23", "a")).toBeNull();
  });
});

describe("monthsShowing", () => {
  const first = (from: string, count: number, shown: string) => toIsoDate(monthsShowing(day(from), count, day(shown)));

  it("stays put while the day is on show", () => {
    expect(first("2026-09-01", 2, "2026-09-15")).toBe("2026-09-01");
    expect(first("2026-09-01", 2, "2026-10-31")).toBe("2026-09-01");
  });

  it("moves back just enough to show an earlier day", () => {
    expect(first("2026-09-01", 2, "2026-08-31")).toBe("2026-08-01");
    expect(first("2026-01-01", 2, "2025-11-10")).toBe("2025-11-01");
  });

  it("moves forward just enough to show a later one", () => {
    expect(first("2026-09-01", 2, "2026-11-02")).toBe("2026-10-01");
    expect(first("2026-09-01", 1, "2026-11-02")).toBe("2026-11-01");
    expect(first("2026-12-01", 2, "2027-02-01")).toBe("2027-01-01");
  });

  it("starts on the first of the month, whatever day it's given", () => {
    expect(first("2026-09-23", 2, "2026-09-25")).toBe("2026-09-01");
  });
});
