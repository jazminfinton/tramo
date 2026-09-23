import { describe, expect, it } from "vitest";

import { startsNavigation } from "@/lib/navigation";

const here = "https://horas.app/week?w=2026-09-21";
const link = (href: string, extra: Partial<{ target: string; download: boolean }> = {}) => ({
  href,
  target: "",
  download: false,
  ...extra,
});
const click = { button: 0, modified: false };

describe("startsNavigation", () => {
  it("is true for a plain click on a link to another page of the app", () => {
    expect(startsNavigation(link("https://horas.app/metrics"), click, here)).toBe(true);
    expect(startsNavigation(link("https://horas.app/week?w=2026-09-14"), click, here)).toBe(true);
  });

  it("is false for the page already on screen, hash changes included", () => {
    expect(startsNavigation(link("https://horas.app/week?w=2026-09-21"), click, here)).toBe(false);
    expect(startsNavigation(link("https://horas.app/week?w=2026-09-21#blocks"), click, here)).toBe(false);
  });

  it("is false when the browser opens something else: another site, a new tab, a download", () => {
    expect(startsNavigation(link("https://example.com/"), click, here)).toBe(false);
    expect(startsNavigation(link("https://horas.app/metrics", { target: "_blank" }), click, here)).toBe(false);
    expect(startsNavigation(link("https://horas.app/export.csv", { download: true }), click, here)).toBe(false);
  });

  it("is false for middle clicks and clicks with a modifier key", () => {
    expect(startsNavigation(link("https://horas.app/metrics"), { button: 1, modified: false }, here)).toBe(false);
    expect(startsNavigation(link("https://horas.app/metrics"), { button: 0, modified: true }, here)).toBe(false);
  });
});
