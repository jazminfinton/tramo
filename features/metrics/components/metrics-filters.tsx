"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { Dropdown } from "@/components/common/dropdown";
import { RadioGroup } from "@/components/common/radio-group";
import { announceNavigation } from "@/components/global/navigation-progress";
import { METRIC_RANGES, type MetricRange } from "@/features/metrics/range";

type MetricsFiltersProps = {
  range: MetricRange;
  project: string | null;
  projects: { id: string; name: string; color: string; archived: boolean }[];
};

const ALL = "all";

/**
 * The one filter row: every chart below re-renders against the same range and
 * project (dataviz rule: never per-chart filters). Filters live in the URL, so
 * a view can be shared and survives a reload.
 *
 * A pick shows at once (optimistic) and starts the top progress bar, even
 * though the charts arrive with the next server render.
 */
export function MetricsFilters({ range, project, projects }: MetricsFiltersProps) {
  const t = useTranslations("metrics.filters");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic({ range, project });

  function go(next: { range?: MetricRange; project?: string | null }) {
    const target = {
      range: next.range ?? shown.range,
      project: next.project === undefined ? shown.project : next.project,
    };
    const params = new URLSearchParams();
    params.set("range", target.range);
    if (target.project) params.set("project", target.project);
    announceNavigation();
    startTransition(() => {
      setShown(target);
      router.push(`/metrics?${params.toString()}`);
    });
  }

  return (
    <div aria-busy={pending} data-tour="metrics-filters" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <RadioGroup
        label={t("range")}
        value={shown.range}
        options={METRIC_RANGES.map((value) => ({ value, label: t(`ranges.${value}`) }))}
        onChange={(value) => go({ range: value })}
        className="inline-flex w-fit gap-1 rounded-tile bg-surface p-1"
        optionClassName={(checked) =>
          `rounded-[6px] px-3 py-1.5 font-display text-sm transition-colors duration-150 ease-signature motion-reduce:transition-none ${
            checked ? "bg-tile text-ink" : "text-ink-muted hover:text-ink"
          }`
        }
        renderOption={(option) => option.label}
      />
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
