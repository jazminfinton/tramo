import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";

import { RefreshOnFocus } from "@/components/common/refresh-on-focus";
import { BarTable } from "@/features/metrics/components/bar-table";
import { MetricsFilters } from "@/features/metrics/components/metrics-filters";
import { PeriodStack } from "@/features/metrics/components/period-stack";
import { getMetrics } from "@/features/metrics/queries";
import { DEFAULT_TIME_ZONE } from "@/i18n/config";
import { requireMember } from "@/lib/dal";
import { formatHours } from "@/lib/duration";
import { zonedDateKey, zonedInstant } from "@/lib/zoned";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel grain flex flex-col gap-4 p-4 sm:p-5">
      <h2 className="font-display text-xs tracking-widest text-ink-dim uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default async function MetricsPage({ searchParams }: PageProps<"/metrics">) {
  const { user, workspace, isAdmin } = await requireMember();
  const { range: rangeParam, project: projectParam } = await searchParams;
  const timeZone = user.timeZone ?? DEFAULT_TIME_ZONE;
  const [t, format, metrics] = await Promise.all([
    getTranslations("metrics"),
    getFormatter(),
    getMetrics({ userId: user.id, workspaceId: workspace.id, isAdmin, timeZone, rangeParam, projectParam }),
  ]);

  // One week reads day by day ("lun 21"), longer ranges week by week ("21 sept").
  const byDay = metrics.range.unit === "day";
  const period = byDay ? "daily" : "weekly";
  const columnLabels = metrics.range.buckets.map((bucket) =>
    format.dateTime(
      zonedInstant(bucket, 12 * 60, timeZone),
      byDay ? { weekday: "short", day: "numeric" } : { day: "numeric", month: "short" },
    ),
  );
  const selectedProject = metrics.projects.find((project) => project.id === metrics.selected);
  const hasData = metrics.total > 0;

  return (
    <>
      <RefreshOnFocus />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-1">
          <h1 className="poster text-6xl uppercase sm:text-7xl">{t("title")}</h1>
          <p className="text-sm text-ink-muted">{isAdmin ? t("subtitleAdmin") : t("subtitleMember")}</p>
        </header>

        {metrics.projects.length === 0 ? (
          <p className="panel grain p-5 text-sm text-ink-muted">{t("noProjects")}</p>
        ) : (
          <>
            <MetricsFilters range={metrics.range.key} project={metrics.selected} projects={metrics.projects} />

            {/* The headline number. Proportional figures, not tabular: it stands alone. */}
            <section className="panel-accent flex flex-col gap-1 p-5">
              <h2 className="text-sm text-ink-muted">
                {selectedProject ? t("totalFor", { project: selectedProject.name }) : t("total")}
              </h2>
              <p className="poster text-8xl text-accent sm:text-9xl">{formatHours(metrics.total)}</p>
              <p className="text-xs text-ink-dim">
                {t("summary", { people: metrics.byPerson.length, projects: metrics.byProject.length })}
              </p>
            </section>

            {!hasData ? (
              <p className="panel grain p-5 text-sm text-ink-muted">{t("empty")}</p>
            ) : (
              <>
                <Card title={t(`${period}.title`)}>
                  <PeriodStack
                    labels={columnLabels}
                    series={metrics.series}
                    caption={t(`${period}.caption`)}
                    bucketHeader={t(`${period}.bucket`)}
                    current={byDay ? metrics.range.buckets.indexOf(zonedDateKey(new Date(), timeZone)) : undefined}
                  />
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card title={t("byPerson.title")}>
                    <BarTable
                      caption={t("byPerson.caption")}
                      nameHeader={t("byPerson.name")}
                      hoursHeader={t("hours")}
                      rows={metrics.byPerson.map((person) => ({ key: person.id, label: person.name, minutes: person.minutes }))}
                    />
                  </Card>

                  {/* One project selected makes this a one-bar chart: the headline already says it. */}
                  {!selectedProject && (
                    <Card title={t("byProject.title")}>
                      <BarTable
                        caption={t("byProject.caption")}
                        nameHeader={t("byProject.name")}
                        hoursHeader={t("hours")}
                        rows={metrics.byProject.map((project) => ({
                          key: project.id,
                          label: project.name,
                          color: project.color,
                          minutes: project.minutes,
                        }))}
                      />
                    </Card>
                  )}

                  <Card title={t("tasks.title")}>
                    {metrics.tasks.length === 0 ? (
                      <p className="text-sm text-ink-muted">{t("tasks.empty")}</p>
                    ) : (
                      <BarTable
                        caption={t("tasks.caption")}
                        nameHeader={t("tasks.name")}
                        hoursHeader={t("hours")}
                        rows={metrics.tasks.map((task) => ({
                          key: `${task.projectId}:${task.description}`,
                          label: task.description,
                          sublabel: selectedProject ? undefined : task.projectName,
                          color: task.projectColor,
                          minutes: task.minutes,
                        }))}
                      />
                    )}
                  </Card>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
