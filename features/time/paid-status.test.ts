import { describe, expect, it } from "vitest";

import { paidStatus, unpaidMinutes } from "@/features/time/paid-status";

const startedAt = new Date("2026-09-23T12:00:00Z");
const endedAt = new Date("2026-09-23T13:00:00Z");
const markedAt = new Date("2026-09-25T12:00:00Z");

const unpaid = { startedAt, endedAt, paidAt: null };
const paid = { startedAt, endedAt, paidAt: markedAt };
const running = { startedAt, endedAt: null, paidAt: null };

describe("paidStatus", () => {
  it("is paid when every finished block is", () => {
    expect(paidStatus([paid, paid])).toBe("paid");
  });

  it("is unpaid when none is", () => {
    expect(paidStatus([unpaid, unpaid])).toBe("unpaid");
  });

  it("is partial when only some are", () => {
    expect(paidStatus([paid, unpaid])).toBe("partial");
  });

  it("leaves out a block still open, which can't be marked yet", () => {
    expect(paidStatus([paid, running])).toBe("paid");
    expect(paidStatus([unpaid, running])).toBe("unpaid");
  });

  it("has nothing to say with no finished block", () => {
    expect(paidStatus([running])).toBeNull();
    expect(paidStatus([])).toBeNull();
  });
});

describe("unpaidMinutes", () => {
  const now = new Date("2026-09-23T15:00:00Z");

  it("adds up the time of the blocks not marked as paid", () => {
    expect(unpaidMinutes([unpaid, paid, unpaid], now)).toBe(120);
  });

  it("leaves their pauses out", () => {
    expect(unpaidMinutes([{ ...unpaid, pausedSeconds: 900 }], now)).toBe(45);
  });

  it("counts a block still running, up to now: nobody has paid for it", () => {
    expect(unpaidMinutes([running], now)).toBe(180);
  });

  it("is zero when everything is paid", () => {
    expect(unpaidMinutes([paid, paid], now)).toBe(0);
  });
});
