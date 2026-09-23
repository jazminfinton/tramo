import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { brandIconSvg, HEXAGON_PATH } from "@/lib/brand-icon";

describe("brandIconSvg", () => {
  const svg = brandIconSvg({ background: "#c5ef5a", foreground: "#171a0c" });

  it("is a hexagon in the theme's accent on a transparent square, like Fragua's mark", () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32">/);
    expect(svg).toContain(`<path d="${HEXAGON_PATH}" fill="#c5ef5a"`);
    expect(svg).not.toContain("<rect");
  });

  it("draws Lucide's hourglass inside, in the color that reads on the accent", () => {
    expect(svg).toContain('stroke="#171a0c"');
    expect(svg).toContain("M17 22v-4.172"); // Lucide's hourglass
  });

  it("only accepts hex colors, so nothing else ends up in the markup", () => {
    expect(() => brandIconSvg({ background: "red\"/><script>", foreground: "#000" })).toThrow();
  });
});

describe("HEXAGON_PATH", () => {
  it("is the same shape the header's badge masks in CSS", () => {
    const css = readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toContain(HEXAGON_PATH);
  });
});
