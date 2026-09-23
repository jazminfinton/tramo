import { describe, expect, it } from "vitest";

import { toSearchKey, typeaheadIndex } from "@/lib/search";

describe("toSearchKey", () => {
  it("folds accents, case and extra spaces", () => {
    expect(toSearchKey("  Diseño   de la LANDING ")).toBe("diseno de la landing");
    expect(toSearchKey("Reunión con el Índigo")).toBe("reunion con el indigo");
  });
});

describe("typeaheadIndex", () => {
  const options = [{ label: "Índigo" }, { label: "Lima", keywords: ["verde"] }];

  it("finds the first option starting with what was typed, accents aside", () => {
    expect(typeaheadIndex(options, "ind")).toBe(0);
    expect(typeaheadIndex(options, "LI")).toBe(1);
  });

  it("also matches keywords", () => {
    expect(typeaheadIndex(options, "ver")).toBe(1);
  });

  it("returns -1 when nothing matches or nothing was typed", () => {
    expect(typeaheadIndex(options, "ambar")).toBe(-1);
    expect(typeaheadIndex(options, " ")).toBe(-1);
  });
});
