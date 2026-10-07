import { describe, expect, it } from "vitest";

import { namedEvery } from "@/features/metrics/axis";

describe("namedEvery", () => {
  it("names every column while they fit", () => {
    expect(namedEvery(4)).toBe(1);
    expect(namedEvery(7)).toBe(1);
    expect(namedEvery(12)).toBe(1);
  });

  it("names them evenly, further apart, once they don't", () => {
    expect(namedEvery(13)).toBe(2);
    expect(namedEvery(24)).toBe(2);
    expect(namedEvery(31)).toBe(3); // a month, day by day
    expect(namedEvery(53)).toBe(5); // a year, week by week
  });

  it("never names more columns than there's room for", () => {
    for (let columns = 1; columns <= 60; columns += 1) {
      expect(Math.ceil(columns / namedEvery(columns))).toBeLessThanOrEqual(12);
    }
  });

  it("copes with an empty chart", () => {
    expect(namedEvery(0)).toBe(1);
  });
});
