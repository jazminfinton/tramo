/** Past this many projects, the rest fold into "Other": the palette has eight slots, never a ninth. */
const MAX_SERIES = 7;

/** One project's minutes per column, and how many of them are paid. A null name is the "Other" series that folds the tail of projects. */
export type PeriodSeries = {
  key: string;
  name: string | null;
  color: string | null;
  values: number[];
  paid: number[];
};

/**
 * Series per day or week, one column per bucket: the top projects keep their own
 * color and the tail folds into one, whose name the client writes in the viewer's
 * language. `ranked` comes with the most hours first.
 */
export function periodSeries(
  rows: { bucket: string; projectId: string; minutes: number; paid: number }[],
  ranked: { id: string; name: string; color: string }[],
  buckets: string[],
): PeriodSeries[] {
  const empty = () => buckets.map(() => 0);
  const columns = new Map(buckets.map((bucket, index) => [bucket, index]));
  const series = new Map(
    ranked
      .slice(0, MAX_SERIES)
      .map(({ id, name, color }): [string, PeriodSeries] => [
        id,
        { key: id, name, color, values: empty(), paid: empty() },
      ]),
  );
  const other: PeriodSeries = { key: "other", name: null, color: null, values: empty(), paid: empty() };

  for (const row of rows) {
    const column = columns.get(row.bucket);
    if (column === undefined) continue;
    const target = series.get(row.projectId) ?? other;
    target.values[column] = (target.values[column] ?? 0) + row.minutes;
    target.paid[column] = (target.paid[column] ?? 0) + row.paid;
  }

  return other.values.some((value) => value > 0) ? [...series.values(), other] : [...series.values()];
}
