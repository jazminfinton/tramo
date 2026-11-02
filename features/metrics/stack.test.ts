import { describe, expect, it } from "vitest";

import { paidPieces } from "@/features/metrics/stack";

const segment = { y: 100, height: 50 };

describe("paidPieces", () => {
  it("is one solid piece when it's all paid", () => {
    expect(paidPieces(segment, 1)).toEqual({ solid: segment, light: null });
  });

  it("is one light piece when none of it is", () => {
    expect(paidPieces(segment, 0)).toEqual({ solid: null, light: segment });
  });

  it("puts what's paid at the bottom and what's left on top, with a gap between them", () => {
    // 50 tall, half paid: 25 of solid, the 2px gap, 23 of light.
    expect(paidPieces(segment, 0.5)).toEqual({
      solid: { y: 125, height: 25 },
      light: { y: 100, height: 23 },
    });
  });

  it("ends both pieces inside the segment", () => {
    const { solid, light } = paidPieces(segment, 0.3);

    expect(light?.y).toBe(segment.y);
    expect((solid?.y ?? 0) + (solid?.height ?? 0)).toBe(segment.y + segment.height);
    expect((light?.height ?? 0) + (solid?.height ?? 0) + 2).toBe(segment.height);
  });

  it("keeps a tiny share visible at either end", () => {
    const almostNothing = paidPieces(segment, 0.001);
    const almostAll = paidPieces(segment, 0.999);

    expect(almostNothing.solid?.height).toBe(1);
    expect(almostAll.light?.height).toBe(1);
  });

  it("takes the tone of most of it when the segment is too thin for two", () => {
    const thin = { y: 100, height: 3 };

    expect(paidPieces(thin, 0.2)).toEqual({ solid: null, light: thin });
    expect(paidPieces(thin, 0.8)).toEqual({ solid: thin, light: null });
  });

  it("copes with a share outside the scale", () => {
    expect(paidPieces(segment, 1.5)).toEqual({ solid: segment, light: null });
    expect(paidPieces(segment, -1)).toEqual({ solid: null, light: segment });
  });
});
