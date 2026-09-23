import { shiftIsoDate, weekRange, zonedWeekStart } from "@/lib/zoned";

export const METRIC_RANGES = ["week", "4w", "12w"] as const;
export type MetricRange = (typeof METRIC_RANGES)[number];

const WEEKS: Record<MetricRange, number> = { week: 1, "4w": 4, "12w": 12 };

/** What one chart column adds up: a local day, or a local week (from Monday). */
export type BucketUnit = "day" | "week";

function isMetricRange(value: unknown): value is MetricRange {
  return typeof value === "string" && (METRIC_RANGES as readonly string[]).includes(value);
}

/**
 * The weeks a metrics range covers, ending with the current one, in the
 * viewer's time zone. Unknown values (it comes from the URL) fall back to four
 * weeks.
 *
 * `buckets` are the chart's columns: a single week reads day by day (one bar
 * would say nothing the headline doesn't), longer ranges week by week.
 */
export function resolveRange(param: string | string[] | undefined, timeZone: string, now: Date) {
  const key: MetricRange = isMetricRange(param) ? param : "4w";
  const count = WEEKS[key];
  const current = zonedWeekStart(now, timeZone);
  const weeks = Array.from({ length: count }, (_, index) => shiftIsoDate(current, -7 * (count - 1 - index)));

  const unit: BucketUnit = key === "week" ? "day" : "week";
  const currentWeek = weekRange(current, timeZone);

  return {
    key,
    weeks,
    unit,
    buckets: unit === "day" ? currentWeek.days : weeks,
    start: weekRange(weeks[0] ?? current, timeZone).start,
    end: currentWeek.end,
  };
}
