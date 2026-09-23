import { describe, expect, it } from "vitest";

import { bucketWeek, resolveWeek } from "@/features/time/week";
import { weekRange } from "@/lib/zoned";

const AR = "America/Argentina/Buenos_Aires";
const { days } = weekRange("2026-09-21", AR);
const now = new Date("2026-09-24T15:00:00Z"); // Thursday 12:00 in Buenos Aires

const entry = (projectId: string, start: string, end: string | null) => ({
  projectId,
  startedAt: new Date(start),
  endedAt: end ? new Date(end) : null,
});

describe("bucketWeek", () => {
  it("adds minutes per project and per day, in the person's zone", () => {
    const week = bucketWeek(
      [
        entry("a", "2026-09-21T12:00:00Z", "2026-09-21T14:30:00Z"), // Mon 2:30
        entry("a", "2026-09-22T12:00:00Z", "2026-09-22T13:00:00Z"), // Tue 1:00
        entry("b", "2026-09-22T14:00:00Z", "2026-09-22T14:45:00Z"), // Tue 0:45
      ],
      days,
      AR,
      now,
    );

    expect(week.byKey.get("a")).toEqual([150, 60, 0, 0, 0, 0, 0]);
    expect(week.byKey.get("b")).toEqual([0, 45, 0, 0, 0, 0, 0]);
    expect(week.dayTotals).toEqual([150, 105, 0, 0, 0, 0, 0]);
    expect(week.total).toBe(255);
  });

  it("gives a block crossing midnight to the day it started", () => {
    // Monday 22:00 to Tuesday 02:00 local.
    const week = bucketWeek([entry("a", "2026-09-22T01:00:00Z", "2026-09-22T05:00:00Z")], days, AR, now);

    expect(week.byKey.get("a")).toEqual([240, 0, 0, 0, 0, 0, 0]);
  });

  it("counts a running block up to now", () => {
    const week = bucketWeek([entry("a", "2026-09-24T14:00:00Z", null)], days, AR, now);

    expect(week.dayTotals[3]).toBe(60);
  });

  it("groups by any key, such as the person, for the team's week", () => {
    const byPerson = [
      { ...entry("a", "2026-09-21T12:00:00Z", "2026-09-21T13:00:00Z"), userId: "ana" },
      { ...entry("b", "2026-09-21T14:00:00Z", "2026-09-21T14:30:00Z"), userId: "ana" },
      { ...entry("a", "2026-09-23T12:00:00Z", "2026-09-23T14:00:00Z"), userId: "beto" },
    ];
    const week = bucketWeek(byPerson, days, AR, now, (block) => block.userId);

    expect(week.byKey.get("ana")).toEqual([90, 0, 0, 0, 0, 0, 0]);
    expect(week.byKey.get("beto")).toEqual([0, 0, 120, 0, 0, 0, 0]);
    expect(week.total).toBe(210);
  });
});

describe("resolveWeek", () => {
  it("defaults to the current week", () => {
    expect(resolveWeek(undefined, AR, now)).toBe("2026-09-21");
  });

  it("accepts any day and snaps it to its Monday", () => {
    expect(resolveWeek("2026-09-10", AR, now)).toBe("2026-09-07");
  });

  it("ignores garbage from the URL", () => {
    expect(resolveWeek("2026-02-31", AR, now)).toBe("2026-09-21");
    expect(resolveWeek(["2026-09-07"], AR, now)).toBe("2026-09-21");
  });
});
