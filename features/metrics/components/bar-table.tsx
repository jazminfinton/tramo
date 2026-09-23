import { formatHours } from "@/lib/duration";

export type BarRow = {
  key: string;
  label: string;
  sublabel?: string;
  /** A project color key; without one the bar takes the theme accent (one series, one color). */
  color?: string;
  minutes: number;
};

type BarTableProps = {
  caption: string;
  nameHeader: string;
  hoursHeader: string;
  rows: BarRow[];
};

/**
 * Ranked horizontal bars that ARE a table: the bars are decoration on top of
 * real rows, so the chart and its table view are the same element.
 *
 * Mark specs (dataviz skill): bars at most 24px thick (12 here), a 4px round
 * data-end and a square baseline, the value at the tip in a text color —
 * never in the series color.
 */
export function BarTable({ caption, nameHeader, hoursHeader, rows }: BarTableProps) {
  const max = Math.max(1, ...rows.map((row) => row.minutes));

  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">{nameHeader}</th>
          <th scope="col">{hoursHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const share = row.minutes / max;
          return (
            <tr key={row.key}>
              <th scope="row" className="w-2/5 max-w-0 py-1.5 pr-3 text-left align-middle font-normal">
                <span className="flex min-w-0 items-center gap-2">
                  {row.color && (
                    <span
                      aria-hidden
                      className="size-2.5 flex-none rounded-full"
                      style={{ backgroundColor: `var(--color-project-${row.color})` }}
                    />
                  )}
                  <span className="truncate">{row.label}</span>
                </span>
                {row.sublabel && <span className="block truncate text-xs text-ink-dim">{row.sublabel}</span>}
              </th>
              <td className="py-1.5 align-middle">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-3 min-w-0.5 rounded-r-[4px]"
                    style={{
                      width: `calc(${(share * 100).toFixed(2)}% - 3.5rem)`,
                      backgroundColor: row.color ? `var(--color-project-${row.color})` : "var(--color-accent)",
                    }}
                  />
                  <span className="digits flex-none text-xs text-ink-muted">{formatHours(row.minutes)}</span>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
