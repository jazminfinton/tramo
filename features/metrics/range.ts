import { isIsoDate, isoDaysBetween, isoWeekStart, shiftIsoDate, zonedInstant, zonedWeekStart } from "@/lib/zoned";

/** The presets: the current week, alone or with the ones before it. */
export const METRIC_RANGES = ["week", "4w", "12w"] as const;
export type MetricRange = (typeof METRIC_RANGES)[number];

/** A range picked day by day on the calendar, instead of a preset. */
export const CUSTOM_RANGE = "custom";
export type RangeKey = MetricRange | typeof CUSTOM_RANGE;

/** The longest range that can be picked by hand: a year, its leap day included. */
export const MAX_RANGE_DAYS = 366;

// Up to a month a picked range reads day by day; a longer one would turn its
// days into slivers, so it reads week by week.
const DAILY_UP_TO = 31;

const WEEKS: Record<MetricRange, number> = { week: 1, "4w": 4, "12w": 12 };

/** What one chart column adds up: a local day, or a local week (from Monday). */
export type BucketUnit = "day" | "week";

/** A value as it comes from the URL: anyone can write anything there. */
type Param = string | string[] | undefined;

function isMetricRange(value: unknown): value is MetricRange {
  return typeof value === "string" && (METRIC_RANGES as readonly string[]).includes(value);
}

/** The two days in the URL, when they make a range: in order, and no longer than a year. */
function pickedDays(from: Param, to: Param): { from: string; to: string } | null {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return null;
  return isoDaysBetween(from, to) < MAX_RANGE_DAYS ? { from, to } : null;
}

/** Every `step`-th calendar day from `first` to `last`, both included. */
function everyDays(first: string, last: string, step: number): string[] {
  const count = Math.floor(isoDaysBetween(first, last) / step) + 1;
  return Array.from({ length: count }, (_, index) => shiftIsoDate(first, index * step));
}

/**
 * The days the metrics cover, in the viewer's time zone: two days picked on
 * the calendar (`from` and `to`), or else a preset (`range`), which ends with
 * the current week. Everything here comes from the URL, so whatever doesn't
 * make sense falls back: a broken pair of days to the preset, an unknown
 * preset to four weeks.
 *
 * `from` and `to` are the first and last calendar day, both included; `start`
 * and `end` are the same span as instants, `end` excluded.
 *
 * `buckets` are the chart's columns, each named by its first day: a single
 * week reads day by day (one bar would say nothing the headline doesn't), and
 * the longer presets week by week. A week at the edge of a picked range only
 * counts the days inside it.
 */
export function resolveRange(params: { range?: Param; from?: Param; to?: Param }, timeZone: string, now: Date) {
  const picked = pickedDays(params.from, params.to);
  const preset: MetricRange = isMetricRange(params.range) ? params.range : "4w";
  const thisWeek = zonedWeekStart(now, timeZone);

  const key: RangeKey = picked ? CUSTOM_RANGE : preset;
  const from = picked?.from ?? shiftIsoDate(thisWeek, -7 * (WEEKS[preset] - 1));
  const to = picked?.to ?? shiftIsoDate(thisWeek, 6);
  const daily = picked ? isoDaysBetween(from, to) < DAILY_UP_TO : preset === "week";
  const unit: BucketUnit = daily ? "day" : "week";

  return {
    key,
    from,
    to,
    unit,
    buckets: daily ? everyDays(from, to, 1) : everyDays(isoWeekStart(from), to, 7),
    start: zonedInstant(from, 0, timeZone),
    end: zonedInstant(shiftIsoDate(to, 1), 0, timeZone),
  };
}

export type ResolvedRange = ReturnType<typeof resolveRange>;
