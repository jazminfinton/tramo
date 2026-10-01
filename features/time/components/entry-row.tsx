import { getFormatter, getTranslations } from "next-intl/server";

import { EntryRowActions } from "@/features/time/components/entry-buttons";
import type { EntryDialogProject } from "@/features/time/components/entry-dialog";
import { entryTitle } from "@/features/time/task-text";
import type { SharedTask } from "@/features/time/tasks";
import { workedMs } from "@/features/time/worked";
import { formatClock, formatHours } from "@/lib/duration";

export type EntryRowData = {
  id: string;
  projectId: string;
  taskId: string | null;
  task: { name: string } | null;
  description: string;
  startedAt: Date;
  endedAt: Date | null;
  pausedAt: Date | null;
  pausedSeconds: number;
  source: "TIMER" | "MANUAL";
  editedAt: Date | null;
  project: { name: string; color: string };
};

type EntryRowProps = {
  entry: EntryRowData;
  /** Show the day next to the times (lists that mix days). */
  showDay?: boolean;
  projects: EntryDialogProject[];
  tasks: SharedTask[];
  suggestions: Record<string, string[]>;
  timeZone: string;
};

/**
 * One block: project, task, times, the time worked in it, and its edit/delete
 * actions. A block still open shows whether it runs or is paused instead.
 */
export async function EntryRow({ entry, showDay = false, projects, tasks, suggestions, timeZone }: EntryRowProps) {
  const [t, format] = await Promise.all([getTranslations("timer.recent"), getFormatter()]);
  // A paused block stands at its pause; one that runs has no end to show yet.
  const endedAt = entry.endedAt ?? entry.pausedAt;
  const pausedMinutes = Math.round(entry.pausedSeconds / 60);
  const title = entryTitle(entry);
  const label = title || entry.project.name;

  return (
    <li className="flex items-center gap-3 py-2.5 pr-2 pl-4 not-first:hairline-t">
      <span
        aria-hidden
        className="size-2.5 flex-none rounded-full"
        style={{ backgroundColor: `var(--color-project-${entry.project.color})` }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">
          {title || <span className="text-ink-dim">{t("noDescription")}</span>}
        </span>
        <span className="truncate text-xs text-ink-dim">
          {entry.project.name}
          {showDay && ` · ${format.dateTime(entry.startedAt, { weekday: "short", day: "numeric", month: "short" })}`}
          {" · "}
          {format.dateTime(entry.startedAt, { timeStyle: "short" })}–
          {endedAt ? format.dateTime(endedAt, { timeStyle: "short" }) : t("now")}
          {pausedMinutes > 0 ? ` · ${t("pauses", { duration: formatHours(pausedMinutes) })}` : ""}
          {entry.source === "MANUAL" || entry.editedAt ? ` · ${t("edited")}` : ""}
        </span>
      </div>
      {!entry.endedAt ? (
        <span className="flex-none rounded-pill bg-accent/15 px-2 py-0.5 font-display text-xs text-accent">
          {entry.pausedAt ? t("onPause") : t("running")}
        </span>
      ) : (
        <>
          <span className="digits flex-none text-sm">{formatClock(workedMs(entry, entry.endedAt))}</span>
          <EntryRowActions
            projects={projects}
            tasks={tasks}
            suggestions={suggestions}
            timeZone={timeZone}
            label={label}
            entry={{
              id: entry.id,
              projectId: entry.projectId,
              taskId: entry.taskId,
              description: entry.description,
              startedAt: entry.startedAt.toISOString(),
              endedAt: entry.endedAt.toISOString(),
              pausedSeconds: entry.pausedSeconds,
            }}
          />
        </>
      )}
    </li>
  );
}
