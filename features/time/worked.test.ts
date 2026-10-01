import { describe, expect, it } from "vitest";

import { workedMs } from "@/features/time/worked";

const at = (iso: string) => new Date(iso);
const now = at("2026-09-30T15:00:00Z");

describe("workedMs", () => {
  it("is the whole span of an entry that was never paused", () => {
    expect(workedMs({ startedAt: at("2026-09-30T12:00:00Z"), endedAt: at("2026-09-30T13:30:00Z") }, now)).toBe(
      90 * 60_000,
    );
  });

  it("leaves out the time spent paused", () => {
    const entry = { startedAt: at("2026-09-30T12:00:00Z"), endedAt: at("2026-09-30T14:00:00Z"), pausedSeconds: 1800 };

    expect(workedMs(entry, now)).toBe(90 * 60_000);
  });

  it("counts a running entry up to now", () => {
    const entry = { startedAt: at("2026-09-30T14:00:00Z"), endedAt: null, pausedAt: null, pausedSeconds: 600 };

    expect(workedMs(entry, now)).toBe(50 * 60_000);
  });

  it("stands still while paused, at the moment the pause began", () => {
    const entry = {
      startedAt: at("2026-09-30T12:00:00Z"),
      endedAt: null,
      pausedAt: at("2026-09-30T12:40:00Z"),
      pausedSeconds: 600,
    };

    expect(workedMs(entry, now)).toBe(30 * 60_000);
    expect(workedMs(entry, at("2026-09-30T20:00:00Z"))).toBe(30 * 60_000);
  });

  it("never goes below zero", () => {
    expect(workedMs({ startedAt: at("2026-09-30T16:00:00Z"), endedAt: null }, now)).toBe(0);
  });
});
