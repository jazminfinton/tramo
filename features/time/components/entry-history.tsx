import type { Route } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { Avatar } from "@/components/common/avatar";
import { Pagination } from "@/components/common/pagination";
import { AddEntryButton, EntryRowActions } from "@/features/time/components/entry-buttons";
import type { EntryDialogProject } from "@/features/time/components/entry-dialog";
import { EntryTabs } from "@/features/time/components/entry-tabs";
import { HistoryFilterBar } from "@/features/time/components/history-filters";
import type { History, HistoryEntry } from "@/features/time/history";
import { hasFilters, historyQuery } from "@/features/time/history-filters";
import { entryTitle } from "@/features/time/task-text";
import type { SharedTask } from "@/features/time/tasks";
import { workedMs } from "@/features/time/worked";
import { formatClock, formatHours } from "@/lib/duration";
import type { PageRequest } from "@/lib/pagination";

type Shared = {
  projects: EntryDialogProject[];
  tasks: SharedTask[];
  suggestions: Record<string, string[]>;
  timeZone: string;
};

/**
 * One finished block: who, what, where and when. Whoever logged it can act on it
 * here, as anywhere; anyone else's is read-only. On a phone, a row with actions
 * has no room for them next to the text, so they go below it.
 */
async function HistoryRow({ entry, mine, ...shared }: { entry: HistoryEntry; mine: boolean } & Shared) {
  const [t, format] = await Promise.all([getTranslations("timer.recent"), getFormatter()]);
  if (!entry.endedAt) return null;
  const pausedMinutes = Math.round(entry.pausedSeconds / 60);
  const title = entryTitle(entry);

  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pl-4 not-first:hairline-t ${mine ? "pr-2" : "pr-4"}`}>
      <Avatar name={entry.user.name} size="sm" />
      <div className="flex min-w-48 flex-1 flex-col">
        {/* Next to the title: the lines below have no room to spare on a phone. */}
        <span className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="truncate">{title || <span className="text-ink-dim">{t("noDescription")}</span>}</span>
          {entry.paidAt && <span className="flex-none font-display text-xs text-accent">{t("paid")}</span>}
        </span>
        {/* Who and where, then when: one line where they fit, two where they don't, never cut short. */}
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 text-xs text-ink-dim">
          <span className="flex max-w-full min-w-0 items-center gap-1.5">
            <span className="truncate">{entry.user.name}</span>
            <span aria-hidden>·</span>
            <span
              aria-hidden
              className="size-2 flex-none rounded-full"
              style={{ backgroundColor: `var(--color-project-${entry.project.color})` }}
            />
            <span className="truncate">{entry.project.name}</span>
          </span>
          <span className="min-w-0">
            {format.dateTime(entry.startedAt, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            {" · "}
            {format.dateTime(entry.startedAt, { timeStyle: "short" })}–
            {format.dateTime(entry.endedAt, { timeStyle: "short" })}
            {pausedMinutes > 0 ? ` · ${t("pauses", { duration: formatHours(pausedMinutes) })}` : ""}
            {entry.source === "MANUAL" || entry.editedAt ? ` · ${t("edited")}` : ""}
          </span>
        </span>
      </div>
      <div className="ml-auto flex flex-none items-center gap-3">
        <span className="digits text-sm">{formatClock(workedMs(entry, entry.endedAt))}</span>
        {mine && (
          <EntryRowActions
            {...shared}
            label={title || entry.project.name}
            entry={{
              id: entry.id,
              projectId: entry.projectId,
              taskId: entry.taskId,
              description: entry.description,
              startedAt: entry.startedAt.toISOString(),
              endedAt: entry.endedAt.toISOString(),
              pausedSeconds: entry.pausedSeconds,
              paid: entry.paidAt !== null,
            }}
          />
        )}
      </div>
    </li>
  );
}

type EntryHistoryProps = Shared & {
  history: History;
  viewerId: string;
  /** Whether it sits in a tab next to the latest blocks. */
  tabs: boolean;
  /** Today on the viewer's calendar. */
  today: string;
};

/** The history tab: the filters, what they found and how much of it there is. */
export async function EntryHistory({ history, viewerId, tabs, today, ...shared }: EntryHistoryProps) {
  const t = await getTranslations("timer.history");
  const { filters, entries, people, blocks, minutes, nextCursor, prevCursor } = history;
  // Relative: it stays on the page it's on.
  const hrefOf = (page: PageRequest) => `?${historyQuery(filters, page)}` as Route;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={tabs ? "sr-only" : "font-display text-xs tracking-widest text-ink-dim uppercase"}>{t("title")}</h2>
        {tabs && <EntryTabs active="history" />}
        <AddEntryButton {...shared} />
      </div>

      <HistoryFilterBar
        filters={filters}
        people={people}
        tasks={shared.tasks}
        today={today}
        summary={t("summary", { count: blocks, hours: formatHours(minutes) })}
      />

      {entries.length === 0 ? (
        <p className="panel grain p-5 text-sm text-ink-muted">{hasFilters(filters) ? t("noMatch") : t("empty")}</p>
      ) : (
        <ul className="panel grain flex flex-col">
          {entries.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} mine={entry.user.id === viewerId} {...shared} />
          ))}
        </ul>
      )}

      <Pagination
        prevHref={prevCursor ? hrefOf({ before: prevCursor }) : null}
        nextHref={nextCursor ? hrefOf({ after: nextCursor }) : null}
      />
    </section>
  );
}
