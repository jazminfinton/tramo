import { describe, expect, it } from "vitest";

import {
  DEFAULT_METRIC_LEAD,
  DEFAULT_METRIC_RANGE,
  isMetricLead,
  isMetricRange,
  leadFirst,
  METRIC_LEADS,
  METRIC_RANGES,
  metricDefaults,
} from "@/lib/metric-views";

describe("the closed sets", () => {
  it("offers three periods, four weeks by default", () => {
    expect(METRIC_RANGES).toEqual(["week", "4w", "12w"]);
    expect(DEFAULT_METRIC_RANGE).toBe("4w");
  });

  it("offers three metrics to lead with, the one over time by default", () => {
    expect(METRIC_LEADS).toEqual(["evolution", "people", "tasks"]);
    expect(DEFAULT_METRIC_LEAD).toBe("evolution");
  });

  it("tells its own values from anything else", () => {
    expect(isMetricRange("12w")).toBe(true);
    expect(isMetricRange("custom")).toBe(false);
    expect(isMetricRange(undefined)).toBe(false);
    expect(isMetricLead("tasks")).toBe(true);
    expect(isMetricLead("projects")).toBe(false);
    expect(isMetricLead(3)).toBe(false);
  });
});

describe("leadFirst", () => {
  it("puts the lead first and leaves the rest in their usual order", () => {
    expect(leadFirst("evolution")).toEqual(["evolution", "people", "tasks"]);
    expect(leadFirst("people")).toEqual(["people", "evolution", "tasks"]);
    expect(leadFirst("tasks")).toEqual(["tasks", "evolution", "people"]);
  });
});

describe("metricDefaults", () => {
  it("reads what a project has stored", () => {
    expect(metricDefaults({ metricsRange: "week", metricsLead: "tasks" })).toEqual({ range: "week", lead: "tasks" });
  });

  it("falls back to the app's own for anything it doesn't know", () => {
    expect(metricDefaults({ metricsRange: "forever", metricsLead: "" })).toEqual({ range: "4w", lead: "evolution" });
    expect(metricDefaults({ metricsRange: "12w", metricsLead: "projects" })).toEqual({ range: "12w", lead: "evolution" });
  });

  it("is the app's own when no project is chosen", () => {
    expect(metricDefaults(null)).toEqual({ range: "4w", lead: "evolution" });
    expect(metricDefaults(undefined)).toEqual({ range: "4w", lead: "evolution" });
  });
});
