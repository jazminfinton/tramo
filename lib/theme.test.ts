import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BRAND_ICON_VERSION,
  brandIconHref,
  DEFAULT_THEME,
  MODES,
  PALETTES,
  isMode,
  isPalette,
  resolveTheme,
  THEME_ACCENTS,
} from "@/lib/theme";

describe("theme catalog", () => {
  it("ships eight palettes in hue order, the grey one last, and two modes", () => {
    expect(PALETTES).toEqual(["lima", "salvia", "cielo", "indigo", "orquidea", "coral", "ambar", "grafito"]);
    expect(MODES).toEqual(["dark", "light"]);
  });

  it("defaults to lima in dark mode", () => {
    expect(DEFAULT_THEME).toEqual({ palette: "lima", mode: "dark" });
  });
});

describe("isPalette / isMode", () => {
  it("accepts only known values", () => {
    expect(isPalette("lima")).toBe(true);
    expect(isPalette("ember")).toBe(false);
    expect(isMode("light")).toBe(true);
    expect(isMode("sepia")).toBe(false);
  });

  it("is strict about casing and whitespace", () => {
    expect(isPalette("Salvia")).toBe(false);
    expect(isPalette(" salvia")).toBe(false);
    expect(isMode("DARK")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isPalette(undefined)).toBe(false);
    expect(isMode(null)).toBe(false);
  });
});

describe("resolveTheme with an account preference", () => {
  it("prefers this browser's cookie, field by field", () => {
    expect(
      resolveTheme({ palette: "lima" }, { palette: "indigo", mode: "light" }),
    ).toEqual({ palette: "lima", mode: "light" });
  });

  it("uses the account preference on a device without cookies", () => {
    expect(resolveTheme({}, { palette: "ambar", mode: "light" })).toEqual({ palette: "ambar", mode: "light" });
  });

  it("ignores invalid account values too", () => {
    expect(resolveTheme({}, { palette: "neon", mode: null })).toEqual(DEFAULT_THEME);
  });
});

describe("resolveTheme", () => {
  it("falls back to the default when nothing is stored", () => {
    expect(resolveTheme({})).toEqual(DEFAULT_THEME);
  });

  it("keeps valid stored values", () => {
    expect(resolveTheme({ palette: "indigo", mode: "light" })).toEqual({
      palette: "indigo",
      mode: "light",
    });
  });

  it("replaces each invalid value on its own", () => {
    expect(resolveTheme({ palette: "ambar", mode: "neon" })).toEqual({
      palette: "ambar",
      mode: "dark",
    });
    expect(resolveTheme({ palette: "<script>", mode: "light" })).toEqual({
      palette: "lima",
      mode: "light",
    });
  });
});

const css = readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");

/** A theme's tokens as app/globals.css spells them out. */
function themeTokens(palette: string, mode: string) {
  const start = css.indexOf(`[data-palette="${palette}"][data-theme="${mode}"] {`);
  const block = start === -1 ? "" : css.slice(start, css.indexOf("}", start));
  return (name: string) => block.match(new RegExp(`--color-${name}: (#[0-9a-f]{6});`, "i"))?.[1];
}

/** WCAG 2.2 contrast ratio between two #rrggbb colors. */
function contrast(a: string, b: string) {
  const channel = (hex: string, at: number) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("THEME_ACCENTS", () => {
  // The favicon is drawn outside CSS, so it carries its own copy of the accent
  // pairs. This keeps that copy honest against app/globals.css.
  it("matches every palette and mode in globals.css", () => {
    for (const palette of PALETTES) {
      for (const mode of MODES) {
        const token = themeTokens(palette, mode);
        expect(THEME_ACCENTS[palette][mode], `${palette}-${mode}`).toEqual({
          accent: token("accent"),
          onAccent: token("on-accent"),
        });
      }
    }
  });
});

describe("every theme in globals.css", () => {
  // The promise in app/globals.css's header: WCAG AA (4.5:1) for text on the
  // surfaces it sits on, in every palette and mode.
  const PAIRS = [
    ["ink", "surface"],
    ["ink", "raised"],
    ["ink-muted", "surface"],
    ["ink-muted", "raised"],
    ["ink-dim", "surface"],
    ["ink-dim", "raised"],
    ["accent", "ground"],
    ["accent", "surface"],
    ["on-accent", "accent"],
    ["warn", "surface"],
  ] as const;

  it("spells out all ten tokens", () => {
    const TOKENS = ["ground", "surface", "raised", "tile", "ink", "ink-muted", "ink-dim", "accent", "on-accent", "warn"];
    for (const palette of PALETTES) {
      for (const mode of MODES) {
        const token = themeTokens(palette, mode);
        expect(TOKENS.filter((name) => !token(name)), `${palette}-${mode}`).toEqual([]);
      }
    }
  });

  it("passes WCAG AA for text on its surfaces", () => {
    for (const palette of PALETTES) {
      for (const mode of MODES) {
        const token = themeTokens(palette, mode);
        for (const [text, ground] of PAIRS) {
          const ratio = contrast(token(text) ?? "#000000", token(ground) ?? "#000000");
          expect(ratio, `${palette}-${mode}: ${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});

describe("brandIconHref", () => {
  it("points at the favicon drawn for the theme, versioned so a new drawing beats the cache", () => {
    expect(brandIconHref({ palette: "lima", mode: "dark" })).toBe(`/brand-icon/lima-dark?v=${BRAND_ICON_VERSION}`);
  });
});
