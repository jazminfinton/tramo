import { getFormatter, getTranslations } from "next-intl/server";

import { AddEntryButton } from "@/features/time/components/entry-buttons";
import { EntryRow } from "@/features/time/components/entry-row";
import { WeekHeader } from "@/features/time/components/week-header";
import type { WeekData } from "@/features/time/queries";
import { formatHours } from "@/lib/duration";
import { zonedDateKey, zonedInstant } from "@/lib/zoned";

/** One person's week: the total, a projects × days grid, and the blocks by day. */
export async function WeekView({ data, timeZone, tabs }: { data: WeekData; timeZone: string; tabs: boolean }) {
  const [t, format] = await Promise.all([getTranslations("week"), getFormatter()]);
  const { week, range, today, currentWeek, entries, buckets, weekProjects, projects, suggestions } = data;
  const shared = { projects, suggestions, timeZone };

  // Noon of each calendar day in the person's zone: a safe instant to format.
  const dayInstant = (isoDate: string) => zonedInstant(isoDate, 12 * 60, timeZone);
  const title = format.dateTimeRange(dayInstant(range.days[0] ?? week), dayInstant(range.days[6] ?? week), {
    day: "numeric",
    month: "long",
  });

  const byDay = new Map<string, typeof entries>();
  for (const entry of entries) {
    const day = zonedDateKey(entry.startedAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }

  return (
    <div className="flex flex-col gap-8">
      <WeekHeader week={week} currentWeek={currentWeek} days={range.days} timeZone={timeZone} view="mine" tabs={tabs} />

      <section className="panel-accent flex items-center justify-between p-5">
        <h2 className="text-sm text-ink-muted">{t("total")}</h2>
        <span className="poster text-7xl text-accent">{formatHours(buckets.total)}</span>
      </section>

      {entries.length > 0 && (
        <div className="panel grain overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <caption className="sr-only">{t("caption", { week: title })}</caption>
            <thead>
              <tr className="text-xs text-ink-dim">
                <th scope="col" className="px-4 py-3 text-left font-display font-normal">
                  {t("project")}
                </th>
                {range.days.map((day) => (
                  <th
                    key={day}
                    scope="col"
                    aria-current={day === today ? "date" : undefined}
                    className="px-2 py-3 text-right font-display font-normal aria-[current=date]:text-accent"
                  >
                    {format.dateTime(dayInstant(day), { weekday: "short" })}
                    <span className="block digits">{format.dateTime(dayInstant(day), { day: "numeric" })}</span>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right font-display font-normal">
                  {t("total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {weekProjects.map((project) => {
                const minutes = buckets.byKey.get(project.id) ?? [];
                const sum = minutes.reduce((total, value) => total + value, 0);
                return (
                  <tr key={project.id} className="hairline-t">
                    <th scope="row" className="max-w-48 px-4 py-2.5 text-left font-normal">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2.5 flex-none rounded-full"
                          style={{ backgroundColor: `var(--color-project-${project.color})` }}
                        />
                        <span className="truncate">{project.name}</span>
                      </span>
                    </th>
                    {minutes.map((value, index) => (
                      <td key={range.days[index]} className={`digits px-2 py-2.5 text-right ${value ? "" : "text-ink-dim"}`}>
                        {formatHours(value)}
                      </td>
                    ))}
                    <td className="digits px-4 py-2.5 text-right">{formatHours(sum)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="hairline-t">
                <th scope="row" className="px-4 py-3 text-left font-display text-xs font-normal tracking-widest text-ink-dim uppercase">
                  {t("total")}
                </th>
                {buckets.dayTotals.map((value, index) => (
                  <td key={range.days[index]} className={`digits px-2 py-3 text-right font-medium ${value ? "" : "text-ink-dim"}`}>
                    {formatHours(value)}
                  </td>
                ))}
                <td className="digits px-4 py-3 text-right font-medium text-accent">{formatHours(buckets.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xs tracking-widest text-ink-dim uppercase">{t("blocks")}</h2>
          <div data-tour="week-add">
            <AddEntryButton {...shared} />
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="panel grain p-5 text-sm text-ink-muted">{t("empty")}</p>
        ) : (
          range.days
            .filter((day) => byDay.has(day))
            .map((day) => (
              <div key={day} className="flex flex-col gap-2">
                <h3 className="flex items-baseline justify-between gap-3 px-1 text-sm">
                  <span className="first-letter:uppercase">
                    {format.dateTime(dayInstant(day), { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  <span className="digits text-ink-muted">{formatHours(buckets.dayTotals[range.days.indexOf(day)] ?? 0)}</span>
                </h3>
                <ul className="panel grain flex flex-col">
                  {(byDay.get(day) ?? []).map((entry) => (
                    <EntryRow key={entry.id} entry={entry} {...shared} />
                  ))}
                </ul>
              </div>
            ))
        )}
      </section>
    </div>
  );
}
