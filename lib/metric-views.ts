/**
 * What a metrics view can open with: its period and the metric that goes
 * first. The closed sets live here because two features share them and
 * features don't import each other: the metrics screens read them, and the
 * projects' admin keeps one of each per project.
 */

/** The preset periods: the current week, alone or with the ones before it. */
export const METRIC_RANGES = ["week", "4w", "12w"] as const;
export type MetricRange = (typeof METRIC_RANGES)[number];
export const DEFAULT_METRIC_RANGE: MetricRange = "4w";

/**
 * The metric a view leads with: how the hours went over time, who put them
 * in, or the tasks they went to.
 */
export const METRIC_LEADS = ["evolution", "people", "tasks"] as const;
export type MetricLead = (typeof METRIC_LEADS)[number];
export const DEFAULT_METRIC_LEAD: MetricLead = "evolution";

export function isMetricRange(value: unknown): value is MetricRange {
  return typeof value === "string" && (METRIC_RANGES as readonly string[]).includes(value);
}

export function isMetricLead(value: unknown): value is MetricLead {
  return typeof value === "string" && (METRIC_LEADS as readonly string[]).includes(value);
}

/** A view's metrics in the order they show: the lead first, the rest in their usual order. */
export function leadFirst(lead: MetricLead): MetricLead[] {
  return [lead, ...METRIC_LEADS.filter((metric) => metric !== lead)];
}

/**
 * What a view opens with: what its project has stored, or the app's own when
 * no project is chosen. The columns are plain text, so anything unknown in
 * them reads as the app's own too.
 */
export function metricDefaults(project: { metricsRange: string; metricsLead: string } | null | undefined) {
  return {
    range: isMetricRange(project?.metricsRange) ? project.metricsRange : DEFAULT_METRIC_RANGE,
    lead: isMetricLead(project?.metricsLead) ? project.metricsLead : DEFAULT_METRIC_LEAD,
  };
}
