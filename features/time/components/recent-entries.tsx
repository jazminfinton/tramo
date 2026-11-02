import { getTranslations } from "next-intl/server";

import { AddEntryButton } from "@/features/time/components/entry-buttons";
import { EntryRow } from "@/features/time/components/entry-row";
import { EntryTabs } from "@/features/time/components/entry-tabs";
import type { TimerPageData } from "@/features/time/queries";

type RecentEntriesProps = {
  entries: TimerPageData["recent"];
  projects: TimerPageData["projects"];
  tasks: TimerPageData["tasks"];
  suggestions: TimerPageData["suggestions"];
  timeZone: string;
};

/** The person's latest finished blocks, newest first, each one editable. */
export async function RecentEntries({ entries, projects, tasks, suggestions, timeZone }: RecentEntriesProps) {
  const t = await getTranslations("timer.recent");
  const shared = { projects, tasks, suggestions, timeZone };

  return (
    <section data-tour="recent-entries" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="sr-only">{t("title")}</h2>
        <EntryTabs active="recent" />
        <AddEntryButton {...shared} />
      </div>

      {entries.length === 0 ? (
        <p className="panel grain p-5 text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="panel grain flex flex-col">
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} showDay {...shared} />
          ))}
        </ul>
      )}
    </section>
  );
}
