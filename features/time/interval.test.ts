import { describe, expect, it } from "vitest";

import { buildInterval, showsSameTimes } from "@/features/time/interval";

const AR = "America/Argentina/Buenos_Aires";
const now = new Date("2026-09-24T12:00:00Z");

const build = (start: string, end: string, date = "2026-09-23") =>
  buildInterval({ date, start, end, timeZone: AR, now });

describe("buildInterval", () => {
  it("builds a same-day block in the person's zone", () => {
    expect(build("09:00", "10:30")).toEqual({
      ok: true,
      startedAt: new Date("2026-09-23T12:00:00Z"),
      endedAt: new Date("2026-09-23T13:30:00Z"),
      minutes: 90,
    });
  });

  it("crosses midnight when the end is earlier than the start", () => {
    expect(build("22:00", "1:30")).toMatchObject({
      ok: true,
      endedAt: new Date("2026-09-24T04:30:00Z"),
      minutes: 210,
    });
  });

  it("takes a duration in the end field when it has units", () => {
    expect(build("09:00", "1h30")).toMatchObject({ ok: true, endedAt: new Date("2026-09-23T13:30:00Z") });
    expect(build("09:00", "+45m")).toMatchObject({ ok: true, minutes: 45 });
  });

  it("refuses a block with the same start and end", () => {
    expect(build("09:00", "9")).toEqual({ ok: false, errors: { end: "tooShort" } });
  });

  it("refuses blocks longer than a day", () => {
    expect(build("09:00", "25h")).toEqual({ ok: false, errors: { end: "tooLong" } });
  });

  it("refuses blocks that end in the future", () => {
    expect(build("08:00", "10:00", "2026-09-24")).toEqual({ ok: false, errors: { end: "future" } });
  });

  it("reports every unreadable field at once", () => {
    expect(buildInterval({ date: "23/09", start: "nope", end: "later", timeZone: AR, now })).toEqual({
      ok: false,
      errors: { date: "invalidDate", start: "invalidStart", end: "invalidEnd" },
    });
  });
});

describe("showsSameTimes", () => {
  // 09:00:30 to 10:30:45 in Buenos Aires: the form shows it as 09:00 and 10:30.
  const entry = { startedAt: new Date("2026-09-23T12:00:30Z"), endedAt: new Date("2026-09-23T13:30:45Z") };

  it("recognizes the entry's own day and times, seconds aside", () => {
    expect(showsSameTimes(entry, { date: "2026-09-23", start: "09:00", end: "10:30" }, AR)).toBe(true);
  });

  it("notices any field that changed", () => {
    expect(showsSameTimes(entry, { date: "2026-09-22", start: "09:00", end: "10:30" }, AR)).toBe(false);
    expect(showsSameTimes(entry, { date: "2026-09-23", start: "09:15", end: "10:30" }, AR)).toBe(false);
    expect(showsSameTimes(entry, { date: "2026-09-23", start: "09:00", end: "11:00" }, AR)).toBe(false);
  });

  it("holds for a block longer than a day, which the form can't spell out", () => {
    const overnight = { startedAt: new Date("2026-09-22T23:00:00Z"), endedAt: new Date("2026-09-24T01:00:00Z") };

    expect(showsSameTimes(overnight, { date: "2026-09-22", start: "20:00", end: "22:00" }, AR)).toBe(true);
  });

  it("is false for times it can't read", () => {
    expect(showsSameTimes(entry, { date: "2026-09-23", start: "", end: "10:30" }, AR)).toBe(false);
  });
});
