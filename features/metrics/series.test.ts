import { describe, expect, it } from "vitest";

import { periodSeries } from "@/features/metrics/series";

const BUCKETS = ["2026-09-21", "2026-09-28"];
const project = (id: string) => ({ id, name: id.toUpperCase(), color: "blue" });
const row = (bucket: string, projectId: string, minutes: number, paid = 0) => ({ bucket, projectId, minutes, paid });

describe("periodSeries", () => {
  it("gives each project its hours and its paid hours per column", () => {
    const series = periodSeries(
      [row("2026-09-21", "a", 120, 60), row("2026-09-28", "a", 30), row("2026-09-28", "b", 45, 45)],
      [project("a"), project("b")],
      BUCKETS,
    );

    expect(series).toEqual([
      { key: "a", name: "A", color: "blue", values: [120, 30], paid: [60, 0] },
      { key: "b", name: "B", color: "blue", values: [0, 45], paid: [0, 45] },
    ]);
  });

  it("leaves out rows of a column that isn't on show", () => {
    const series = periodSeries([row("2026-01-01", "a", 120, 120)], [project("a")], BUCKETS);

    expect(series).toEqual([{ key: "a", name: "A", color: "blue", values: [0, 0], paid: [0, 0] }]);
  });

  it("folds the tail into one series past seven projects, its paid hours too", () => {
    const projects = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map(project);
    const series = periodSeries(
      [row("2026-09-21", "a", 10), row("2026-09-21", "h", 20, 5), row("2026-09-21", "i", 30, 10)],
      projects,
      BUCKETS,
    );

    expect(series).toHaveLength(8);
    expect(series.at(-1)).toEqual({ key: "other", name: null, color: null, values: [50, 0], paid: [15, 0] });
  });

  it("has no tail with nothing to fold", () => {
    expect(periodSeries([row("2026-09-21", "a", 10)], [project("a")], BUCKETS).map((item) => item.key)).toEqual(["a"]);
  });
});
