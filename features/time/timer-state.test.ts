import { describe, expect, it } from "vitest";

import { clockParts, elapsedMs, timerState } from "@/features/time/timer-state";

const project = { name: "Web", color: "blue" };
const entry = {
  projectId: "p1",
  description: "Login",
  startedAt: new Date("2026-09-24T12:00:00Z"),
  pausedAt: null,
  pausedSeconds: 0,
  project,
};

describe("timerState", () => {
  it("runs while the open entry isn't paused", () => {
    expect(timerState({ ...entry, pausedSeconds: 600 })).toEqual({
      state: "running",
      projectId: "p1",
      description: "Login",
      startedAt: "2026-09-24T12:00:00.000Z",
      pausedAt: null,
      pausedSeconds: 600,
      projectName: "Web",
      projectColor: "blue",
    });
  });

  it("is paused while the open entry carries a pause", () => {
    expect(timerState({ ...entry, pausedAt: new Date("2026-09-24T12:20:00Z") })).toMatchObject({
      state: "paused",
      startedAt: "2026-09-24T12:00:00.000Z",
      pausedAt: "2026-09-24T12:20:00.000Z",
    });
  });

  it("is idle with nothing open", () => {
    expect(timerState(null)).toBeNull();
  });
});

describe("elapsedMs", () => {
  const now = new Date("2026-09-24T12:30:00Z").getTime();

  it("is the time since play, minus the pauses", () => {
    expect(elapsedMs(timerState({ ...entry, pausedSeconds: 600 }), now)).toBe(20 * 60_000);
  });

  it("stands still while paused, and is zero when idle", () => {
    const paused = timerState({ ...entry, pausedAt: new Date("2026-09-24T12:20:00Z"), pausedSeconds: 300 });

    expect(elapsedMs(paused, now)).toBe(15 * 60_000);
    expect(elapsedMs(paused, now + 3_600_000)).toBe(15 * 60_000);
    expect(elapsedMs(null, now)).toBe(0);
  });
});

describe("clockParts", () => {
  it("splits a duration into two-digit hours, minutes and seconds", () => {
    expect(clockParts(3_723_000)).toEqual({ hours: "01", minutes: "02", seconds: "03" });
  });

  it("lets hours grow past two digits", () => {
    expect(clockParts(123 * 3_600_000)).toEqual({ hours: "123", minutes: "00", seconds: "00" });
  });

  it("never goes below zero", () => {
    expect(clockParts(-5_000)).toEqual({ hours: "00", minutes: "00", seconds: "00" });
  });
});
