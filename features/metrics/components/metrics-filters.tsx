"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { DateRangeField } from "@/components/common/date-range-field";
import { Dropdown } from "@/components/common/dropdown";
import { RadioGroup } from "@/components/common/radio-group";
import { announceNavigation } from "@/components/global/navigation-progress";
import { CUSTOM_RANGE, MAX_RANGE_DAYS, METRIC_RANGES, type ResolvedRange } from "@/features/metrics/range";

/** The days on show and what chose them: a preset, or two days on the calendar. */
type Period = Pick<ResolvedRange, "key" | "from" | "to">;

type MetricsFiltersProps = {
  period: Period;
  project: string | null;
  projects: { id: string; name: string; color: string; archived: boolean }[];
  /** Today on the viewer's calendar: the last day the calendar offers. */
  today: string;
};

const ALL = "all";

/**
 * The one filter row: every chart below re-renders against the same days and
 * project (dataviz rule: never per-chart filters). Filters live in the URL, so
 * a view can be shared and survives a reload.
 *
 * The days come from a preset or from the calendar, one or the other: picking
 * a range leaves no preset checked, and a preset takes the calendar's range
 * away.
 *
 * A pick shows at once (optimistic) and starts the top progress bar, even
 * though the charts arrive with the next server render.
 */
export function MetricsFilters({ period, project, projects, today }: MetricsFiltersProps) {
  const t = useTranslations("metrics.filters");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic({ period, project });
  const picked = shown.period.key === CUSTOM_RANGE;

  function go(next: { period?: Period; project?: string | null }) {
    const target = {
      period: next.period ?? shown.period,
      project: next.project === undefined ? shown.project : next.project,
    };
    const params = new URLSearchParams();
    if (target.period.key === CUSTOM_RANGE) {
      params.set("from", target.period.from);
      params.set("to", target.period.to);
    } else {
      params.set("range", target.period.key);
    }
    if (target.project) params.set("project", target.project);
    announceNavigation();
    startTransition(() => {
      setShown(target);
      router.push(`/metrics?${params.toString()}`);
    });
  }

  return (
    <div
      aria-busy={pending}
      data-tour="metrics-filters"
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center gap-2">
        <RadioGroup
          label={t("range")}
          value={shown.period.key === CUSTOM_RANGE ? null : shown.period.key}
          options={METRIC_RANGES.map((value) => ({ value, label: t(`ranges.${value}`) }))}
          // The preset's own days arrive with the next render; until then the
          // calendar would open on the ones on show, which is close enough.
          onChange={(key) => go({ period: { ...shown.period, key } })}
          className="inline-flex w-fit gap-1 rounded-tile bg-surface p-1"
          optionClassName={(checked) =>
            `rounded-[6px] px-3 py-1.5 font-display text-sm transition-colors duration-150 ease-signature motion-reduce:transition-none ${
              checked ? "bg-tile text-ink" : "text-ink-muted hover:text-ink"
            }`
          }
          renderOption={(option) => option.label}
        />
        <DateRangeField
          data-tour="metrics-dates"
          label={t("dates")}
          placeholder={t("pickDates")}
          picked={picked}
          value={{ from: shown.period.from, to: shown.period.to }}
          max={today}
          maxDays={MAX_RANGE_DAYS}
          onChange={(range) => go({ period: { key: CUSTOM_RANGE, ...range } })}
        />
      </div>
      <Dropdown
        label={t("project")}
        value={shown.project ?? ALL}
        onChange={(value) => go({ project: value === ALL ? null : value })}
        options={[
          { value: ALL, label: t("allProjects") },
          ...projects.map((item) => ({
            value: item.id,
            label: item.archived ? t("archived", { name: item.name }) : item.name,
            icon: (
              <span
                aria-hidden
                className="size-2.5 flex-none rounded-full"
                style={{ backgroundColor: `var(--color-project-${item.color})` }}
              />
            ),
          })),
        ]}
        className="sm:w-64"
      />
    </div>
  );
}
