import { describe, expect, it } from "vitest";

import { metricsQuery, switchProject, type MetricsView } from "@/features/metrics/filters";

const days = { from: "2026-09-01", to: "2026-09-30" };
const view = (key: MetricsView["period"]["key"], explicit: boolean, project: string | null = null): MetricsView => ({
  period: { key, ...days, explicit },
  project,
});

describe("metricsQuery", () => {
  it("carries a period the viewer picked: a preset by name, days by their dates", () => {
    expect(metricsQuery(view("12w", true))).toBe("range=12w");
    expect(metricsQuery(view("custom", true))).toBe("from=2026-09-01&to=2026-09-30");
  });

  it("leaves a default period out, so it stays a default", () => {
    expect(metricsQuery(view("4w", false))).toBe("");
    expect(metricsQuery(view("week", false, "p1"))).toBe("project=p1");
  });

  it("adds the project after the period", () => {
    expect(metricsQuery(view("week", true, "p1"))).toBe("range=week&project=p1");
    expect(metricsQuery(view("custom", true, "p1"))).toBe("from=2026-09-01&to=2026-09-30&project=p1");
  });
});

describe("switchProject", () => {
  const defaults = { p1: "week", p2: "12w" } as const;

  it("opens the new project on its own period when the viewer hasn't picked one", () => {
    expect(switchProject(view("4w", false), "p1", defaults)).toEqual(view("week", false, "p1"));
    expect(switchProject(view("week", false, "p1"), "p2", defaults)).toEqual(view("12w", false, "p2"));
  });

  it("goes back to four weeks for every project together", () => {
    expect(switchProject(view("week", false, "p1"), null, defaults)).toEqual(view("4w", false, null));
  });

  it("keeps a period the viewer picked, whatever the project", () => {
    expect(switchProject(view("12w", true), "p1", defaults)).toEqual(view("12w", true, "p1"));
    expect(switchProject(view("custom", true, "p1"), null, defaults)).toEqual(view("custom", true, null));
  });

  it("falls back to four weeks for a project it doesn't know", () => {
    expect(switchProject(view("week", false, "p1"), "p9", defaults)).toEqual(view("4w", false, "p9"));
  });
});
