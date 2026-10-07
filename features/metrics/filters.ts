import { CUSTOM_RANGE, type RangeKey } from "@/features/metrics/range";
import { DEFAULT_METRIC_RANGE, type MetricRange } from "@/lib/metric-views";

// What the filter row decides, apart from how it's drawn, so it can be tested
// on its own: where a view lives in the URL, and what switching projects does
// to its period.

/**
 * The days on show and what chose them. `explicit` tells a period the viewer
 * picked (it's in the URL) from the default the view opened with.
 */
export type Period = { key: RangeKey; from: string; to: string; explicit: boolean };

export type MetricsView = { period: Period; project: string | null };

/**
 * A view's place in the URL. Only what the viewer picked travels in it: a
 * default period is left out, so it stays a default and each project can open
 * on its own.
 */
export function metricsQuery({ period, project }: MetricsView): string {
  const params = new URLSearchParams();
  if (period.explicit && period.key === CUSTOM_RANGE) {
    params.set("from", period.from);
    params.set("to", period.to);
  } else if (period.explicit) {
    params.set("range", period.key);
  }
  if (project) params.set("project", project);
  return params.toString();
}

/**
 * The view after switching projects. A period the viewer picked stays with
 * them; otherwise the new project's own takes over (`defaults`, by project
 * id), or the app's when every project shows together.
 */
export function switchProject(
  view: MetricsView,
  project: string | null,
  defaults: Readonly<Record<string, MetricRange>>,
): MetricsView {
  if (view.period.explicit) return { ...view, project };
  const key = (project && defaults[project]) || DEFAULT_METRIC_RANGE;
  return { period: { ...view.period, key }, project };
}
