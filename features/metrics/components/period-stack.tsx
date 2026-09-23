"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { formatHours } from "@/lib/duration";

/** A null name is the "Other" series that folds the tail of projects. */
export type PeriodSeries = { key: string; name: string | null; color: string | null; values: number[] };

type PeriodStackProps = {
  /** One per column, already formatted on the server ("21 sept", "lun 21"). */
  labels: string[];
  series: PeriodSeries[];
  /** Accessible name of the chart and its table. */
  caption: string;
  /** Header of the table's first column: what one column is ("Semana", "Día"). */
  bucketHeader: string;
  /** The column that gets the one direct label: today, or this week. Defaults to the last. */
  current?: number;
};

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 20, right: 12, bottom: 28, left: 44 };
const GAP = 2; // the surface gap between stacked segments
const RADIUS = 4;

const fill = (color: string | null) => (color ? `var(--color-project-${color})` : "var(--color-ink-dim)");

/** Rounds the step up to 1, 2 or 5 × 10ⁿ hours, so ticks read as clean numbers. */
function niceMaxHours(maxMinutes: number) {
  const hours = Math.max(1, maxMinutes / 60);
  const magnitude = 10 ** Math.floor(Math.log10(hours));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= hours) ?? hours;
  return step;
}

/** A bar segment with only its top corners rounded: round data-end, square baseline. */
function topRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, height, width / 2);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

/**
 * Hours per day or per week, stacked by project. Hover or keyboard focus on a
 * column shows its breakdown; the same numbers are always available in the
 * table below (tooltips enhance, never gate). The legend is always shown: two
 * or more series never rely on color alone.
 */
export function PeriodStack({ labels: columnLabels, series: rawSeries, caption, bucketHeader, current }: PeriodStackProps) {
  const t = useTranslations("metrics.chart");
  const series = rawSeries.map((item) => ({ ...item, name: item.name ?? t("other") }));
  const labels = {
    caption,
    bucket: bucketHeader,
    total: t("total"),
    showTable: t("showTable"),
    hours: (value: number) => t("tick", { hours: value }),
  };
  const [active, setActive] = useState<number | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

  const totals = columnLabels.map((_, index) => series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0));
  const maxHours = niceMaxHours(Math.max(...totals, 0));
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const band = plotWidth / Math.max(1, columnLabels.length);
  const barWidth = Math.min(24, band * 0.6);
  const highlight = Math.min(band, barWidth + 32);
  const y = (minutes: number) => (minutes / 60 / maxHours) * plotHeight;
  const ticks = [0, maxHours / 2, maxHours];
  const labeled = current ?? columnLabels.length - 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Legend first: identity never depends on matching colors by eye. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        {series.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[3px]" style={{ backgroundColor: fill(item.color) }} />
            {item.name}
          </li>
        ))}
      </ul>

      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="group" aria-label={labels.caption}>
          {ticks.map((tick) => {
            const tickY = PAD.top + plotHeight - (tick / maxHours) * plotHeight;
            return (
              <g key={tick} aria-hidden>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={tickY}
                  y2={tickY}
                  stroke="var(--color-ink)"
                  strokeOpacity={tick === 0 ? 0.25 : 0.08}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={tickY}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="digits"
                  fontSize={11}
                  fill="var(--color-ink-dim)"
                >
                  {labels.hours(tick)}
                </text>
              </g>
            );
          })}

          {columnLabels.map((columnLabel, index) => {
            const center = PAD.left + band * index + band / 2;
            const x = center - barWidth / 2;
            let cumulative = 0;
            const visible = series.filter((item) => (item.values[index] ?? 0) > 0);

            return (
              <g
                key={columnLabel}
                tabIndex={0}
                role="img"
                aria-label={`${columnLabel}: ${formatHours(totals[index] ?? 0)}`}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="group/column outline-none"
              >
                {/* The hit area is the whole band, far bigger than the mark. */}
                <rect x={PAD.left + band * index} y={PAD.top} width={band} height={plotHeight} fill="transparent" />
                {/* What hover and keyboard focus light up: a column hugging the
                    bar, so a wide band never frames the whole chart. */}
                <rect
                  x={center - highlight / 2}
                  y={PAD.top - 4}
                  width={highlight}
                  height={plotHeight + 8}
                  rx={6}
                  fill="var(--color-ink)"
                  fillOpacity={active === index ? 0.05 : 0}
                  stroke="transparent"
                  strokeWidth={2}
                  className="pointer-events-none group-focus-visible/column:stroke-accent"
                />
                {visible.map((item, stackIndex) => {
                  const value = item.values[index] ?? 0;
                  const height = y(value);
                  const isTop = stackIndex === visible.length - 1;
                  const segmentHeight = Math.max(0, height - (isTop ? 0 : GAP));
                  const top = PAD.top + plotHeight - y(cumulative) - height;
                  cumulative += value;
                  if (segmentHeight <= 0) return null;
                  return isTop ? (
                    <path key={item.key} d={topRoundedRect(x, top, barWidth, segmentHeight, RADIUS)} fill={fill(item.color)} />
                  ) : (
                    <rect key={item.key} x={x} y={top + GAP} width={barWidth} height={segmentHeight} fill={fill(item.color)} />
                  );
                })}
                <text
                  x={center}
                  y={HEIGHT - PAD.bottom + 18}
                  textAnchor="middle"
                  fontSize={11}
                  fill={active === index ? "var(--color-ink)" : "var(--color-ink-dim)"}
                >
                  {columnLabel}
                </text>
                {/* One direct label, the current column's total: selective, not on every column. */}
                {index === labeled && (totals[index] ?? 0) > 0 && (
                  <text
                    x={center}
                    y={PAD.top + plotHeight - y(totals[index] ?? 0) - 6}
                    textAnchor="middle"
                    fontSize={11}
                    className="digits"
                    fill="var(--color-ink)"
                  >
                    {formatHours(totals[index] ?? 0)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {active !== null && (
          <div
            role="status"
            className="menu-pop pointer-events-none absolute top-0 z-10 w-52 rounded-tile bg-raised p-3 text-xs shadow-lg shadow-black/25"
            style={{
              left: `clamp(0px, calc(${(((PAD.left + band * active + band / 2) / WIDTH) * 100).toFixed(2)}% - 6.5rem), calc(100% - 13rem))`,
            }}
          >
            <p className="mb-2 font-display text-ink">{columnLabels[active]}</p>
            <ul className="flex flex-col gap-1">
              {series
                .filter((item) => (item.values[active] ?? 0) > 0)
                .reverse()
                .map((item) => (
                  <li key={item.key} className="flex items-center gap-2 text-ink-muted">
                    <span aria-hidden className="size-2 flex-none rounded-[2px]" style={{ backgroundColor: fill(item.color) }} />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="digits text-ink">{formatHours(item.values[active] ?? 0)}</span>
                  </li>
                ))}
            </ul>
            <p className="hairline-t mt-2 flex justify-between pt-2 text-ink">
              <span>{labels.total}</span>
              <span className="digits">{formatHours(totals[active] ?? 0)}</span>
            </p>
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          aria-expanded={tableOpen}
          onClick={() => setTableOpen((open) => !open)}
          className="inline-flex items-center gap-1.5 font-display text-xs text-ink-muted transition-colors duration-150 ease-signature hover:text-ink motion-reduce:transition-none"
        >
          <ChevronDown
            aria-hidden
            className={`icon size-3.5 transition-transform duration-150 ease-signature motion-reduce:transition-none ${tableOpen ? "rotate-180" : ""}`}
          />
          {labels.showTable}
        </button>
        {tableOpen && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <caption className="sr-only">{labels.caption}</caption>
              <thead>
                <tr className="text-ink-dim">
                  <th scope="col" className="py-2 pr-3 text-left font-normal">
                    {labels.bucket}
                  </th>
                  {series.map((item) => (
                    <th key={item.key} scope="col" className="px-2 py-2 text-right font-normal">
                      {item.name}
                    </th>
                  ))}
                  <th scope="col" className="py-2 pl-2 text-right font-normal">
                    {labels.total}
                  </th>
                </tr>
              </thead>
              <tbody>
                {columnLabels.map((columnLabel, index) => (
                  <tr key={columnLabel} className="hairline-t">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      {columnLabel}
                    </th>
                    {series.map((item) => (
                      <td key={item.key} className="digits px-2 py-2 text-right">
                        {formatHours(item.values[index] ?? 0)}
                      </td>
                    ))}
                    <td className="digits py-2 pl-2 text-right font-medium">{formatHours(totals[index] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
