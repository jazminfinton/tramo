import { describe, expect, it } from "vitest";

import { defaultBlock, endOptions, startOptions, timeKeywords, toClock } from "@/features/time/time-options";
import { typeaheadIndex } from "@/lib/search";

describe("toClock", () => {
  it("writes minutes of the day as HH:MM", () => {
    expect(toClock(0)).toBe("00:00");
    expect(toClock(9 * 60 + 5)).toBe("09:05");
    expect(toClock(23 * 60 + 45)).toBe("23:45");
  });
});

describe("startOptions", () => {
  it("offers every quarter hour of the day", () => {
    const options = startOptions();
    expect(options).toHaveLength(96);
    expect(options[0]).toBe(0);
    expect(options[1]).toBe(15);
    expect(options.at(-1)).toBe(23 * 60 + 45);
  });

  it("keeps a time off the grid, in order, so editing a timer block shows it", () => {
    const options = startOptions(9 * 60 + 7);
    expect(options).toHaveLength(97);
    expect(options.slice(36, 39)).toEqual([9 * 60, 9 * 60 + 7, 9 * 60 + 15]);
  });

  it("doesn't repeat a time that is already on the grid", () => {
    expect(startOptions(9 * 60 + 30)).toHaveLength(96);
  });
});

describe("endOptions", () => {
  it("starts a quarter after the start and says how long each choice lasts", () => {
    const options = endOptions(9 * 60);
    expect(options[0]).toEqual({ minutes: 9 * 60 + 15, duration: 15, nextDay: false });
    expect(options[3]).toEqual({ minutes: 10 * 60, duration: 60, nextDay: false });
  });

  it("goes past midnight into the next day, up to 23 h 45 min", () => {
    const options = endOptions(22 * 60);
    expect(options).toHaveLength(95);
    expect(options.find((option) => option.minutes === 0)).toEqual({ minutes: 0, duration: 120, nextDay: true });
    expect(options.at(-1)).toEqual({ minutes: 21 * 60 + 45, duration: 23 * 60 + 45, nextDay: true });
  });

  it("follows a start off the grid, and keeps an end off the grid", () => {
    const options = endOptions(9 * 60 + 7, 11 * 60 + 52);
    expect(options[0]).toEqual({ minutes: 9 * 60 + 22, duration: 15, nextDay: false });
    expect(options).toContainEqual({ minutes: 11 * 60 + 52, duration: 165, nextDay: false });
    const durations = options.map((option) => option.duration);
    expect(durations).toEqual([...durations].sort((a, b) => a - b));
  });
});

describe("timeKeywords", () => {
  it("lets people type a time the short way", () => {
    expect(timeKeywords(9 * 60 + 30)).toEqual(["9:30", "0930", "930"]);
    expect(timeKeywords(9 * 60)).toEqual(["9:00", "0900", "900", "9"]);
    expect(timeKeywords(18 * 60)).toEqual(["1800", "18"]);
  });

  it("reaches the time people mean when they type it", () => {
    const options = startOptions().map((minutes) => ({ label: toClock(minutes), keywords: timeKeywords(minutes) }));
    const typed = (text: string) => options[typeaheadIndex(options, text)]?.label;

    expect(typed("9")).toBe("09:00");
    expect(typed("930")).toBe("09:30");
    expect(typed("13")).toBe("13:00");
    expect(typed("1330")).toBe("13:30");
    expect(typed("18:4")).toBe("18:45");
    expect(typed("0")).toBe("00:00");
  });
});

describe("defaultBlock", () => {
  it("proposes the last full hour before now, on the quarter grid", () => {
    expect(defaultBlock(15 * 60 + 40)).toEqual({ start: 14 * 60 + 30, end: 15 * 60 + 30 });
  });

  it("never proposes a start before midnight", () => {
    expect(defaultBlock(0 * 60 + 40)).toEqual({ start: 0, end: 30 });
    expect(defaultBlock(5)).toEqual({ start: 0, end: 60 });
  });
});
