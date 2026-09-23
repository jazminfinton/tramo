import { getFormatter, getTranslations } from "next-intl/server";

import { Avatar } from "@/components/common/avatar";
import { WeekHeader } from "@/features/time/components/week-header";
import type { TeamWeekData } from "@/features/time/queries";
import type { TeamEntry } from "@/features/time/team";
import { formatClock, formatHours } from "@/lib/duration";
import { zonedDateKey, zonedInstant } from "@/lib/zoned";

/** One block of the team's week, read-only: who, what, where and when. */
async function TeamEntryRow({ entry }: { entry: TeamEntry }) {
  const [t, format] = await Promise.all([getTranslations("timer.recent"), getFormatter()]);
  const running = entry.endedAt === null;
  const endedAt = entry.endedAt ?? entry.startedAt;

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 not-first:hairline-t">
      <Avatar name={entry.user.name} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">
          {entry.description || <span className="text-ink-dim">{t("noDescription")}</span>}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-dim">
          <span className="truncate">{entry.user.name}</span>
          <span aria-hidden>·</span>
          <span
            aria-hidden
            className="size-2 flex-none rounded-full"
            style={{ backgroundColor: `var(--color-project-${entry.project.color})` }}
          />
          <span className="truncate">{entry.project.name}</span>
          <span aria-hidden>·</span>
          <span className="flex-none">
            {format.dateTime(entry.startedAt, { timeStyle: "short" })}–
            {running ? t("now") : format.dateTime(endedAt, { timeStyle: "short" })}
            {entry.source === "MANUAL" || entry.editedAt ? ` · ${t("edited")}` : ""}
          </span>
        </span>
      </div>
      {running ? (
        <span className="flex-none rounded-pill bg-accent/15 px-2 py-0.5 font-display text-xs text-accent">{t("running")}</span>
      ) : (
        <span className="digits flex-none text-sm">{formatClock(endedAt.getTime() - entry.startedAt.getTime())}</span>
      )}
    </li>
  );
}

/**
 * The team's week, in detail: the total, hours per person and per day, and
 * every block by day with who logged it. Observers see this instead of a week
 * of their own; trackers reach it from "Equipo".
 */
export async function TeamWeekView({ data, timeZone, tabs }: { data: TeamWeekData; timeZone: string; tabs: boolean }) {
  const [t, format] = await Promise.all([getTranslations("week"), getFormatter()]);
  const { week, range, today, currentWeek, entries, buckets, people } = data;

  const dayInstant = (isoDate: string) => zonedInstant(isoDate, 12 * 60, timeZone);
  const title = format.dateTimeRange(dayInstant(range.days[0] ?? week), dayInstant(range.days[6] ?? week), {
    day: "numeric",
    month: "long",
  });

  const byDay = new Map<string, TeamEntry[]>();
  for (const entry of entries) {
    const day = zonedDateKey(entry.startedAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }

  return (
    <div className="flex flex-col gap-8">
      <WeekHeader week={week} currentWeek={currentWeek} days={range.days} timeZone={timeZone} view="team" tabs={tabs} />

      <section className="panel-accent flex items-center justify-between p-5">
        <h2 className="text-sm text-ink-muted">{t("teamTotal")}</h2>
        <span className="poster text-7xl text-accent">{formatHours(buckets.total)}</span>
      </section>

      {entries.length > 0 && (
        <div className="panel grain overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <caption className="sr-only">{t("teamCaption", { week: title })}</caption>
            <thead>
              <tr className="text-xs text-ink-dim">
                <th scope="col" className="px-4 py-3 text-left font-display font-normal">
                  {t("person")}
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
              {people.map((person) => {
                const minutes = buckets.byKey.get(person.id) ?? [];
                const sum = minutes.reduce((total, value) => total + value, 0);
                return (
                  <tr key={person.id} className="hairline-t">
                    <th scope="row" className="max-w-48 px-4 py-2.5 text-left font-normal">
                      <span className="flex items-center gap-2">
                        <Avatar name={person.name} size="sm" />
                        <span className="truncate">{person.name}</span>
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

      <section data-tour="team-blocks" className="flex flex-col gap-4">
        <h2 className="font-display text-xs tracking-widest text-ink-dim uppercase">{t("teamBlocks")}</h2>
        {entries.length === 0 ? (
          <p className="panel grain p-5 text-sm text-ink-muted">{t("teamEmpty")}</p>
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
                    <TeamEntryRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              </div>
            ))
        )}
      </section>
    </div>
  );
}
