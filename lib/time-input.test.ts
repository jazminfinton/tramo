import { describe, expect, it } from "vitest";

import { parseClockTime, parseDuration } from "@/lib/time-input";

describe("parseClockTime (minutes since midnight)", () => {
  it("reads the usual ways of writing a time", () => {
    expect(parseClockTime("14:30")).toBe(14 * 60 + 30);
    expect(parseClockTime("9:05")).toBe(9 * 60 + 5);
    expect(parseClockTime("1430")).toBe(14 * 60 + 30);
    expect(parseClockTime("930")).toBe(9 * 60 + 30);
    expect(parseClockTime("14")).toBe(14 * 60);
    expect(parseClockTime("14.30")).toBe(14 * 60 + 30);
    expect(parseClockTime(" 7 ")).toBe(7 * 60);
  });

  it("rejects times that don't exist", () => {
    expect(parseClockTime("24:00")).toBeNull();
    expect(parseClockTime("12:60")).toBeNull();
    expect(parseClockTime("abc")).toBeNull();
    expect(parseClockTime("")).toBeNull();
  });
});

describe("parseDuration (minutes)", () => {
  it("reads hours and minutes with units", () => {
    expect(parseDuration("1h30")).toBe(90);
    expect(parseDuration("1h 30m")).toBe(90);
    expect(parseDuration("2h")).toBe(120);
    expect(parseDuration("45m")).toBe(45);
    expect(parseDuration("90 min")).toBe(90);
  });

  it("reads decimal hours with a comma or a dot", () => {
    expect(parseDuration("1,5h")).toBe(90);
    expect(parseDuration("0.25h")).toBe(15);
  });

  it("reads h:mm as a duration when asked for one", () => {
    expect(parseDuration("1:30")).toBe(90);
  });

  it("needs a unit for bare numbers, so a time is never mistaken for a duration", () => {
    expect(parseDuration("90")).toBeNull();
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("h")).toBeNull();
  });
});
