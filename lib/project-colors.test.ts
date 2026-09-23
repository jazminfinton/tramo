import { describe, expect, it } from "vitest";

import { PROJECT_COLORS, isProjectColor, nextProjectColor } from "@/lib/project-colors";

describe("PROJECT_COLORS", () => {
  it("keeps the validated categorical order", () => {
    expect(PROJECT_COLORS).toEqual(["blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red"]);
  });

  it("recognizes only catalog colors", () => {
    expect(isProjectColor("aqua")).toBe(true);
    expect(isProjectColor("teal")).toBe(false);
    expect(isProjectColor(undefined)).toBe(false);
  });
});

describe("nextProjectColor", () => {
  it("starts with the first slot", () => {
    expect(nextProjectColor([])).toBe("blue");
  });

  it("takes the first unused slot, in order", () => {
    expect(nextProjectColor(["blue", "orange"])).toBe("aqua");
    expect(nextProjectColor(["orange"])).toBe("blue");
  });

  it("reuses the least-used slot once all eight are taken", () => {
    const used = [...PROJECT_COLORS, "blue", "orange", "aqua"];
    expect(nextProjectColor(used)).toBe("yellow");
  });

  it("ignores unknown values", () => {
    expect(nextProjectColor(["teal", "blue"])).toBe("orange");
  });
});
