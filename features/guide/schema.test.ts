import { describe, expect, it } from "vitest";

import { tourStepSchema } from "@/features/guide/schema";
import { TOUR_DONE } from "@/features/guide/tour";

describe("tourStepSchema", () => {
  it("accepts a step index, and the mark of a finished tour", () => {
    expect(tourStepSchema.parse(0)).toBe(0);
    expect(tourStepSchema.parse(11)).toBe(11);
    expect(tourStepSchema.parse(TOUR_DONE)).toBe(TOUR_DONE);
  });

  it("rejects anything that isn't a small whole number", () => {
    for (const value of [-1, 1.5, 1000, "3", null]) {
      expect(tourStepSchema.safeParse(value).success, String(value)).toBe(false);
    }
  });
});
