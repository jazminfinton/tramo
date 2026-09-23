import { describe, expect, it } from "vitest";

import {
  addMonths,
  formatDateInput,
  fromIsoDate,
  isSameDay,
  monthGrid,
  parseDateInput,
  toIsoDate,
} from "@/lib/dates";

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
