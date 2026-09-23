import { getFormatter, getTranslations } from "next-intl/server";

import { EntryRowActions } from "@/features/time/components/entry-buttons";
import type { EntryDialogProject } from "@/features/time/components/entry-dialog";
import { formatClock } from "@/lib/duration";

export type EntryRowData = {
  id: string;
  projectId: string;
  description: string;
  startedAt: Date;
  endedAt: Date | null;
  source: "TIMER" | "MANUAL";
  editedAt: Date | null;
  project: { name: string; color: string };
};

type EntryRowProps = {
  entry: EntryRowData;
  /** Show the day next to the times (lists that mix days). */
  showDay?: boolean;
  projects: EntryDialogProject[];
  suggestions: Record<string, string[]>;
  timeZone: string;
};

/** One block: project, task, times, duration, and its edit/delete actions. */
export async function EntryRow({ entry, showDay = false, projects, suggestions, timeZone }: EntryRowProps) {
  const [t, format] = await Promise.all([getTranslations("timer.recent"), getFormatter()]);
  const running = entry.endedAt === null;
  const endedAt = entry.endedAt ?? entry.startedAt;
  const label = entry.description || entry.project.name;

  return (
    <li className="flex items-center gap-3 py-2.5 pr-2 pl-4 not-first:hairline-t">
      <span
        aria-hidden
        className="size-2.5 flex-none rounded-full"
        style={{ backgroundColor: `var(--color-project-${entry.project.color})` }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">
          {entry.description || <span className="text-ink-dim">{t("noDescription")}</span>}
        </span>
        <span className="truncate text-xs text-ink-dim">
          {entry.project.name}
          {showDay && ` · ${format.dateTime(entry.startedAt, { weekday: "short", day: "numeric", month: "short" })}`}
          {" · "}
          {format.dateTime(entry.startedAt, { timeStyle: "short" })}–
          {running ? t("now") : format.dateTime(endedAt, { timeStyle: "short" })}
          {entry.source === "MANUAL" || entry.editedAt ? ` · ${t("edited")}` : ""}
        </span>
      </div>
      {running ? (
        <span className="flex-none rounded-pill bg-accent/15 px-2 py-0.5 font-display text-xs text-accent">{t("running")}</span>
      ) : (
        <>
          <span className="digits flex-none text-sm">{formatClock(endedAt.getTime() - entry.startedAt.getTime())}</span>
          <EntryRowActions
            projects={projects}
            suggestions={suggestions}
            timeZone={timeZone}
            label={label}
            entry={{
              id: entry.id,
              projectId: entry.projectId,
              description: entry.description,
              startedAt: entry.startedAt.toISOString(),
              endedAt: endedAt.toISOString(),
            }}
          />
        </>
      )}
    </li>
  );
}
