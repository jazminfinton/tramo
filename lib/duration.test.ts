import { describe, expect, it } from "vitest";

import { FORGOTTEN_AFTER_MS, formatClock, formatHours, isForgotten } from "@/lib/duration";

describe("formatHours", () => {
  it("shows minutes as h:mm, the way totals are read", () => {
    expect(formatHours(150)).toBe("2:30");
    expect(formatHours(5)).toBe("0:05");
    expect(formatHours(0)).toBe("0:00");
    expect(formatHours(61 * 60)).toBe("61:00");
  });

  it("rounds to the nearest minute", () => {
    expect(formatHours(89.6)).toBe("1:30");
  });
});

const HOUR = 60 * 60 * 1000;

describe("formatClock", () => {
  it("formats as hh:mm:ss with zero padding", () => {
    expect(formatClock(0)).toBe("00:00:00");
    expect(formatClock((1 * 3600 + 23 * 60 + 45) * 1000)).toBe("01:23:45");
  });

  it("drops the milliseconds instead of rounding up", () => {
    expect(formatClock(59_999)).toBe("00:00:59");
  });

  it("keeps counting past a day", () => {
    expect(formatClock(100 * HOUR)).toBe("100:00:00");
  });

  it("never shows a negative time (clock skew)", () => {
    expect(formatClock(-5_000)).toBe("00:00:00");
  });
});

describe("isForgotten", () => {
  const start = new Date("2026-09-23T09:00:00Z");

  it("flags a timer running for 8 hours or more", () => {
    expect(FORGOTTEN_AFTER_MS).toBe(8 * HOUR);
    expect(isForgotten(start, new Date(start.getTime() + 8 * HOUR))).toBe(true);
  });

  it("leaves shorter sessions alone", () => {
    expect(isForgotten(start, new Date(start.getTime() + 8 * HOUR - 1))).toBe(false);
  });
});
