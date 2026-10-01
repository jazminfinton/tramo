"use client";

import { Pause, PictureInPicture2, Play, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { Autocomplete } from "@/components/common/autocomplete";
import { Dropdown } from "@/components/common/dropdown";
import { FIELD } from "@/components/common/field";
import { HexButton } from "@/components/common/hex-button";
import { Modal } from "@/components/common/modal";
import { finishTimerAction, pauseTimerAction, resumeTimerAction, startTimerAction } from "@/features/time/actions";
import { ClockTiles } from "@/features/time/components/clock-tiles";
import { PipTimer } from "@/features/time/components/pip-timer";
import { TaskPicker } from "@/features/time/components/task-picker";
import { useDocumentPip } from "@/features/time/components/use-document-pip";
import type { TimerPageData } from "@/features/time/queries";
import { DESCRIPTION_MAX } from "@/features/time/schema";
import type { SharedTask } from "@/features/time/tasks";
import { elapsedMs, type TimerState } from "@/features/time/timer-state";
import { formatClock, isForgotten } from "@/lib/duration";

type TimerBarProps = {
  projects: TimerPageData["projects"];
  tasks: TimerPageData["tasks"];
  timer: TimerPageData["timer"];
  suggestions: TimerPageData["suggestions"];
  serverNow: number;
};

function ProjectDot({ color, className = "size-2.5" }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex-none rounded-full ${className}`}
      style={{ backgroundColor: `var(--color-project-${color})` }}
    />
  );
}

type Action = { label: string; disabled: boolean; onClick: () => void };

// Declared outside TimerBar on purpose: the clock re-renders every second, and
// a component defined inside render would remount each time, dropping focus.
function PrimaryButton({ showsPause, label, disabled, onClick }: Action & { showsPause: boolean }) {
  const Icon = showsPause ? Pause : Play;
  return (
    <HexButton tone="accent" onClick={onClick} aria-disabled={disabled} aria-label={label} className="size-16">
      <Icon className="icon size-7" aria-hidden />
    </HexButton>
  );
}

function FinishButton({ label, disabled, onClick }: Action) {
  return (
    <HexButton tone="tile" onClick={onClick} aria-disabled={disabled} aria-label={label} className="size-12">
      <Square className="icon size-5" aria-hidden />
    </HexButton>
  );
}

/**
 * The timer: project, what the work is (one of the team's shared tasks, free
 * text, or both), a clock in blocks and its buttons. Play starts the task in
 * the fields; pause stops the clock where it is, and play resumes it from
 * there; the square finishes the task and takes the clock back to zero.
 *
 * The server owns the truth (the person's open entry); this component only
 * shows it, changing optimistically so every click feels instant.
 */
export function TimerBar({ projects, tasks, timer, suggestions, serverNow }: TimerBarProps) {
  const t = useTranslations("timer");
  const [current, setCurrent] = useOptimistic<TimerState | null>(timer);
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(timer?.projectId ?? projects[0]?.id ?? "");
  const [task, setTask] = useState<SharedTask | null>(
    timer?.taskId && timer.taskName ? { id: timer.taskId, name: timer.taskName } : null,
  );
  const [description, setDescription] = useState(timer?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [forgottenDismissed, setForgottenDismissed] = useState(false);
  // `now` is the server's clock: the first render uses the server's value, then
  // each tick uses the client's clock corrected by the measured offset.
  const [now, setNow] = useState(serverNow);
  const offset = useRef(0);
  const originalTitle = useRef<string | null>(null);
  const pip = useDocumentPip();

  useEffect(() => {
    offset.current = serverNow - Date.now();
  }, [serverNow]);

  const running = current?.state === "running";
  const elapsed = elapsedMs(current, now);
  const clock = formatClock(elapsed);
  const clockState = current?.state ?? "idle";

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // While running, the tab title is the clock: visible even with the tab in
  // the background, which covers browsers without the floating window.
  useEffect(() => {
    originalTitle.current ??= document.title;
    document.title = current
      ? `${running ? clock : `${t("paused")} · ${clock}`} · ${current.projectName}`
      : originalTitle.current;
  }, [current, running, clock, t]);

  useEffect(
    () => () => {
      if (originalTitle.current) document.title = originalTitle.current;
    },
    [],
  );

  const selectedProject = projects.find((project) => project.id === projectId);
  const normalizedDescription = description.replace(/\s+/g, " ").trim();
  const isCurrentTask =
    current !== null &&
    current.projectId === projectId &&
    current.taskId === (task?.id ?? null) &&
    current.description === normalizedDescription;
  const serverNowIso = () => new Date(Date.now() + offset.current).toISOString();

  function run(change: () => Promise<{ error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await change();
      if (result?.error) setError(result.error);
    });
  }

  // A new task: the one in the fields, from zero.
  function start() {
    if (!selectedProject) return;
    run(async () => {
      setCurrent({
        state: "running",
        projectId: selectedProject.id,
        taskId: task?.id ?? null,
        taskName: task?.name ?? null,
        description: normalizedDescription,
        startedAt: serverNowIso(),
        pausedAt: null,
        pausedSeconds: 0,
        projectName: selectedProject.name,
        projectColor: selectedProject.color,
      });
      setForgottenDismissed(false);
      return startTimerAction(selectedProject.id, normalizedDescription, task?.id ?? null);
    });
  }

  // The task stays the same one across pauses: pausing notes when it began,
  // and resuming adds that pause to the time left out of the clock.
  function pause() {
    if (!current) return;
    run(async () => {
      setCurrent({ ...current, state: "paused", pausedAt: serverNowIso() });
      return pauseTimerAction();
    });
  }

  function resume() {
    if (!current) return;
    run(async () => {
      const pausedFor = current.pausedAt ? Date.now() + offset.current - new Date(current.pausedAt).getTime() : 0;
      setCurrent({
        ...current,
        state: "running",
        pausedAt: null,
        pausedSeconds: current.pausedSeconds + Math.max(0, Math.round(pausedFor / 1000)),
      });
      setForgottenDismissed(false);
      return resumeTimerAction();
    });
  }

  function finish() {
    run(async () => {
      setCurrent(null);
      return finishTimerAction();
    });
  }

  // Play and pause share one button: it pauses the task that runs, resumes the
  // one that's paused, and otherwise starts what the fields say (a new task).
  const primary =
    running && isCurrentTask
      ? { showsPause: true, label: t("pause"), onClick: pause }
      : current?.state === "paused" && isCurrentTask
        ? { showsPause: false, label: t("resume"), onClick: resume }
        : { showsPause: false, label: current ? t("switch") : t("start"), onClick: start };
  const primaryAction = { ...primary, disabled: pending || !selectedProject };
  const finishAction = current ? { label: t("finish"), disabled: pending, onClick: finish } : null;

  // Forgotten means running for hours on end; time spent paused doesn't count.
  const forgotten = running && !forgottenDismissed && isForgotten(new Date(now - elapsed), new Date(now));

  const units = { hours: t("units.hours"), minutes: t("units.minutes"), seconds: t("units.seconds") };

  const detail = current ? (
    <>
      <ProjectDot color={current.projectColor} className="size-[0.7em]" />
      <span className="truncate">
        {current.state === "paused" && `${t("paused")} · `}
        {[current.projectName, current.taskName, current.description].filter(Boolean).join(" · ")}
      </span>
    </>
  ) : (
    <span className="truncate">{t("idle")}</span>
  );

  return (
    <section aria-label={t("title")} data-tour="timer" className="panel grain flex flex-col gap-5 p-4 sm:p-5">
      {/* What the work is: the project and one of the team's shared tasks
          side by side, the free text under them. A phone stacks all three. */}
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <Dropdown
          label={t("project")}
          value={projectId}
          onChange={setProjectId}
          options={projects.map((project) => ({
            value: project.id,
            label: project.name,
            icon: <ProjectDot color={project.color} />,
          }))}
        />
        <TaskPicker tasks={tasks} value={task?.id ?? ""} onChange={setTask} />
        <Autocomplete
          label={t("description")}
          value={description}
          onChange={setDescription}
          suggestions={suggestions[projectId] ?? []}
          placeholder={t("descriptionPlaceholder")}
          maxLength={DESCRIPTION_MAX}
          onSubmit={start}
          className="sm:col-span-2"
          inputClassName={FIELD}
        />
      </div>

      {/* A phone stacks the clock over its buttons, both centered; from md
          there's room for one row, the buttons at the end, level with the
          tiles (the padding clears the unit names). */}
      <div className="flex flex-col items-center gap-4 md:flex-row md:items-end md:gap-6">
        <ClockTiles
          ms={elapsed}
          state={clockState}
          label={t("elapsed")}
          units={units}
          className="text-[clamp(3.5rem,17vw,6.5rem)]"
        />

        <div className="flex items-center gap-2 md:ml-auto md:pb-6">
          {pip.supported && (
            <HexButton
              tone="ghost"
              data-tour="timer-pop-out"
              aria-label={pip.pipWindow ? t("closePopOut") : t("popOut")}
              aria-pressed={pip.pipWindow !== null}
              onClick={() => (pip.pipWindow ? pip.close() : pip.open({ width: 280, height: 320 }))}
              className="size-12"
            >
              <PictureInPicture2 className="icon size-5" aria-hidden />
            </HexButton>
          )}
          {finishAction && <FinishButton {...finishAction} />}
          <PrimaryButton {...primaryAction} />
        </div>
      </div>

      <p className="flex min-w-0 items-center justify-center-safe gap-2 text-sm text-ink-dim md:justify-start">
        {detail}
      </p>

      {error && (
        <p role="alert" className="text-center text-sm text-warn md:text-left">
          {t(`errors.${error as "generic"}`)}
        </p>
      )}

      <Modal open={forgotten} onClose={() => setForgottenDismissed(true)} title={t("forgotten.title")}>
        <p className="text-sm text-ink-muted">
          {t("forgotten.body", {
            hours: Math.floor(elapsed / 3_600_000),
            project: current?.projectName ?? "",
          })}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setForgottenDismissed(true)}
            className="rounded-tile px-4 py-2.5 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none"
          >
            {t("forgotten.keep")}
          </button>
          <button
            type="button"
            onClick={() => {
              setForgottenDismissed(true);
              finish();
            }}
            className="rounded-tile bg-accent px-4 py-2.5 font-display text-sm font-medium text-on-accent transition-opacity duration-150 ease-signature hover:opacity-90 motion-reduce:transition-none"
          >
            {t("forgotten.stop")}
          </button>
        </div>
      </Modal>

      {pip.pipWindow &&
        createPortal(
          <PipTimer
            ms={elapsed}
            state={clockState}
            clockLabel={t("elapsed")}
            units={units}
            detail={detail}
            primary={primaryAction}
            finish={finishAction}
          />,
          pip.pipWindow.document.body,
        )}
    </section>
  );
}
