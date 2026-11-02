import { formatHours } from "@/lib/duration";

export type BarRow = {
  key: string;
  label: string;
  sublabel?: string;
  /** A project color key; without one the bar takes the theme accent (one series, one color). */
  color?: string;
  minutes: number;
  /** How many of them are paid: the bar splits in two tones. Without it, the bar is one solid piece. */
  paid?: number;
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
 * never in the series color. A bar that knows what's paid keeps its color, solid
 * for that and lighter for what's left, with a surface gap between the two.
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
          const left = row.paid === undefined ? 0 : Math.max(0, row.minutes - row.paid);
          const color = row.color ? `var(--color-project-${row.color})` : "var(--color-accent)";
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
                {row.sublabel && <span className="digits block truncate text-xs text-ink-dim">{row.sublabel}</span>}
              </th>
              <td className="py-1.5 align-middle">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex h-3 min-w-0.5 gap-0.5"
                    style={{ width: `calc(${(share * 100).toFixed(2)}% - 3.5rem)` }}
                  >
                    {(left === 0 || left < row.minutes) && (
                      <span
                        className="min-w-0.5 basis-0 last:rounded-r-[4px]"
                        style={{ flexGrow: Math.max(1, row.minutes - left), backgroundColor: color }}
                      />
                    )}
                    {left > 0 && (
                      <span
                        className="min-w-0.5 basis-0 rounded-r-[4px] opacity-40"
                        style={{ flexGrow: left, backgroundColor: color }}
                      />
                    )}
                  </span>
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
