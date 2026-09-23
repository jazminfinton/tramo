import { describe, expect, it } from "vitest";

import { rovingTarget } from "@/lib/roving-focus";

describe("rovingTarget", () => {
  it("moves forward with ArrowRight and ArrowDown, wrapping at the end", () => {
    expect(rovingTarget("ArrowRight", 0, 4)).toBe(1);
    expect(rovingTarget("ArrowDown", 2, 4)).toBe(3);
    expect(rovingTarget("ArrowRight", 3, 4)).toBe(0);
  });

  it("moves backward with ArrowLeft and ArrowUp, wrapping at the start", () => {
    expect(rovingTarget("ArrowLeft", 2, 4)).toBe(1);
    expect(rovingTarget("ArrowUp", 1, 4)).toBe(0);
    expect(rovingTarget("ArrowLeft", 0, 4)).toBe(3);
  });

  it("jumps to the edges with Home and End", () => {
    expect(rovingTarget("Home", 2, 4)).toBe(0);
    expect(rovingTarget("End", 0, 4)).toBe(3);
  });

  it("ignores keys that don't navigate", () => {
    expect(rovingTarget("Enter", 1, 4)).toBeNull();
    expect(rovingTarget("a", 1, 4)).toBeNull();
  });

  it("returns null for an empty group", () => {
    expect(rovingTarget("ArrowRight", 0, 0)).toBeNull();
  });
});
