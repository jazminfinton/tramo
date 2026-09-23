import { describe, expect, it } from "vitest";

import { clockParts, elapsedMs, timerState } from "@/features/time/timer-state";

const project = { name: "Web", color: "blue" };
const block = { projectId: "p1", description: "Login", startedAt: new Date("2026-09-24T12:00:00Z"), project };
const session = { projectId: "p1", description: "Login", doneSeconds: 600, project };

describe("timerState", () => {
  it("runs, adding what the task already did", () => {
    expect(timerState(block, session)).toEqual({
      state: "running",
      projectId: "p1",
      description: "Login",
      startedAt: "2026-09-24T12:00:00.000Z",
      doneSeconds: 600,
      projectName: "Web",
      projectColor: "blue",
    });
  });

  it("runs from zero when the session belongs to another task, or there's none", () => {
    expect(timerState(block, { ...session, description: "Otra" })?.doneSeconds).toBe(0);
    expect(timerState(block, null)?.doneSeconds).toBe(0);
  });

  it("is paused when only the session is left", () => {
    expect(timerState(null, session)).toEqual({
      state: "paused",
      projectId: "p1",
      description: "Login",
      startedAt: null,
      doneSeconds: 600,
      projectName: "Web",
      projectColor: "blue",
    });
  });

  it("is idle with neither", () => {
    expect(timerState(null, null)).toBeNull();
  });
});

describe("elapsedMs", () => {
  const now = new Date("2026-09-24T12:05:00Z").getTime();

  it("adds the running block to what the task already did", () => {
    expect(elapsedMs(timerState(block, session), now)).toBe(600_000 + 300_000);
  });

  it("stands still while paused, and is zero when idle", () => {
    expect(elapsedMs(timerState(null, session), now)).toBe(600_000);
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
