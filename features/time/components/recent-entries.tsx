import { getTranslations } from "next-intl/server";

import { AddEntryButton } from "@/features/time/components/entry-buttons";
import { EntryRow } from "@/features/time/components/entry-row";
import type { TimerPageData } from "@/features/time/queries";

type RecentEntriesProps = {
  entries: TimerPageData["recent"];
  projects: TimerPageData["projects"];
  suggestions: TimerPageData["suggestions"];
  timeZone: string;
};

/** The person's latest finished blocks, newest first, each one editable. */
export async function RecentEntries({ entries, projects, suggestions, timeZone }: RecentEntriesProps) {
  const t = await getTranslations("timer.recent");
  const shared = { projects, suggestions, timeZone };

  return (
    <section data-tour="recent-entries" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xs tracking-widest text-ink-dim uppercase">{t("title")}</h2>
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
