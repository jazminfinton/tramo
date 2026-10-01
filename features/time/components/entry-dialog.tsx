"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";

import { Autocomplete } from "@/components/common/autocomplete";
import { DateField } from "@/components/common/date-field";
import { Dropdown } from "@/components/common/dropdown";
import { Field, FIELD, FIELD_LABEL } from "@/components/common/field";
import { Modal } from "@/components/common/modal";
import { TaskPicker } from "@/features/time/components/task-picker";
import { createEntryAction, updateEntryAction } from "@/features/time/entry-actions";
import { buildInterval } from "@/features/time/interval";
import { DESCRIPTION_MAX } from "@/features/time/schema";
import type { SharedTask } from "@/features/time/tasks";
import { defaultBlock, endOptions, startOptions, timeKeywords, toClock } from "@/features/time/time-options";
import { focusFirstInvalid, type FieldErrors } from "@/lib/form";
import { parseClockTime } from "@/lib/time-input";
import { zonedDateKey, zonedMinutesOfDay } from "@/lib/zoned";

export type EntryDialogProject = { id: string; name: string; color: string };

export type EditableEntry = {
  id: string;
  projectId: string;
  /** The shared task the block sits under, if any. */
  taskId: string | null;
  description: string;
  startedAt: string;
  endedAt: string;
  /** Seconds the timer measured in pauses: they stay out of the time worked. */
  pausedSeconds: number;
};

type EntryDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Without an entry the dialog adds a new block. */
  entry?: EditableEntry;
  projects: EntryDialogProject[];
  /** The workspace's shared tasks. */
  tasks: SharedTask[];
  suggestions: Record<string, string[]>;
  timeZone: string;
};

function initialValues(entry: EditableEntry | undefined, projects: EntryDialogProject[], timeZone: string) {
  if (!entry) {
    const now = new Date();
    const block = defaultBlock(zonedMinutesOfDay(now, timeZone));
    return {
      projectId: projects[0]?.id ?? "",
      taskId: "",
      description: "",
      date: zonedDateKey(now, timeZone),
      start: toClock(block.start),
      end: toClock(block.end),
    };
  }
  const startedAt = new Date(entry.startedAt);
  const endedAt = new Date(entry.endedAt);
  return {
    projectId: entry.projectId,
    taskId: entry.taskId ?? "",
    description: entry.description,
    date: zonedDateKey(startedAt, timeZone),
    start: toClock(zonedMinutesOfDay(startedAt, timeZone)),
    end: toClock(zonedMinutesOfDay(endedAt, timeZone)),
  };
}

/**
 * Add or fix a block by hand. Start and end are picked from lists on a
 * quarter-hour grid, like a calendar: each end says how long the block lasts,
 * and an end before the start means the next day. Changing the start keeps
 * the duration. Every block saved here is flagged as manual or edited.
 *
 * What the block was about is one of the team's shared tasks, free text, or
 * both: this is also where an older block gets moved onto a shared task.
 *
 * A block the timer paused keeps its pauses: they show here, and stay out of
 * its time whatever the new times are. Times left untouched aren't rebuilt
 * from the form, so a task paused overnight keeps its real span.
 */
export function EntryDialog(props: EntryDialogProps) {
  const t = useTranslations("entries");
  // The form remounts each time the dialog opens, so it always starts from
  // the entry's current values (or a fresh block).
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.entry ? t("editTitle") : t("addTitle")}>
      {props.open && <EntryForm {...props} />}
    </Modal>
  );
}

function EntryForm({ onClose, entry, projects, tasks, suggestions, timeZone }: EntryDialogProps) {
  const t = useTranslations("entries");
  const [initial] = useState(() => initialValues(entry, projects, timeZone));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  const set = (field: keyof typeof values) => (value: string) => setValues((current) => ({ ...current, [field]: value }));

  const startMinutes = parseClockTime(values.start);
  const endMinutes = parseClockTime(values.end);

  // A new start moves the end with it: the block keeps its duration.
  function changeStart(start: string) {
    setValues((current) => {
      const from = parseClockTime(current.start);
      const to = parseClockTime(current.end);
      const next = parseClockTime(start);
      if (from === null || to === null || next === null) return { ...current, start };
      const duration = (to - from + 24 * 60) % (24 * 60) || 60;
      return { ...current, start, end: toClock((next + duration) % (24 * 60)) };
    });
  }

  // The form still shows the block's own day and times: they stay as stored.
  const untouched =
    entry !== undefined && values.date === initial.date && values.start === initial.start && values.end === initial.end;
  const pausedMinutes = Math.round((entry?.pausedSeconds ?? 0) / 60);

  const preview = untouched
    ? {
        ok: true as const,
        endedAt: new Date(entry.endedAt),
        minutes: Math.round((new Date(entry.endedAt).getTime() - new Date(entry.startedAt).getTime()) / 60_000),
      }
    : values.start.trim() && values.end.trim()
      ? buildInterval({ ...values, timeZone, now: new Date() })
      : null;

  function describeDuration(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return t("durationMinutes", { minutes: rest });
    if (rest === 0) return t("durationHours", { hours });
    return t("durationHoursMinutes", { hours, minutes: rest });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const clientErrors: FieldErrors = {};
    if (!values.projectId) clientErrors.projectId = "projectRequired";
    if (!untouched) {
      const interval = buildInterval({ ...values, timeZone, now: new Date() });
      if (!interval.ok) Object.assign(clientErrors, interval.errors);
      else if (interval.minutes <= pausedMinutes) clientErrors.end = "pausesTooLong";
    }
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      focusFirstInvalid(form, clientErrors);
      return;
    }

    startTransition(async () => {
      const result = entry ? await updateEntryAction(entry.id, formData) : await createEntryAction(formData);
      if (result?.fieldErrors) {
        setErrors(result.fieldErrors);
        focusFirstInvalid(form, result.fieldErrors);
        return;
      }
      if (result?.error) {
        setErrors({ form: result.error });
        return;
      }
      onClose();
    });
  }

  const errorText = (key: string | undefined) => (key ? t(`errors.${key as "generic"}`) : undefined);
  const crossesMidnight = preview?.ok && zonedDateKey(preview.endedAt, timeZone) !== values.date;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>{t("project")}</span>
        <Dropdown
          label={t("project")}
          name="projectId"
          value={values.projectId}
          onChange={set("projectId")}
          aria-invalid={errors.projectId ? true : undefined}
          options={projects.map((project) => ({
            value: project.id,
            label: project.name,
            icon: (
              <span
                aria-hidden
                className="size-2.5 flex-none rounded-full"
                style={{ backgroundColor: `var(--color-project-${project.color})` }}
              />
            ),
          }))}
        />
        {errors.projectId && (
          <p role="alert" className="text-xs text-warn">
            {errorText(errors.projectId)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>{t("task")}</span>
        <TaskPicker
          tasks={tasks}
          name="taskId"
          value={values.taskId}
          onChange={(task) => set("taskId")(task?.id ?? "")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>{t("description")}</span>
        <Autocomplete
          label={t("description")}
          name="description"
          value={values.description}
          onChange={set("description")}
          suggestions={suggestions[values.projectId] ?? []}
          placeholder={t("descriptionPlaceholder")}
          maxLength={DESCRIPTION_MAX}
          inputClassName={FIELD}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>{t("date")}</span>
        <DateField
          label={t("date")}
          name="date"
          value={values.date}
          onChange={set("date")}
          aria-invalid={errors.date ? true : undefined}
        />
        {errors.date && (
          <p role="alert" className="text-xs text-warn">
            {errorText(errors.date)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("start")} error={errorText(errors.start)} required>
          {(fieldProps) => (
            <Dropdown
              id={fieldProps.id}
              aria-invalid={fieldProps["aria-invalid"]}
              aria-describedby={fieldProps["aria-describedby"]}
              label={t("start")}
              name="start"
              value={values.start}
              onChange={changeStart}
              placeholder={t("pickTime")}
              numeric
              className="w-full"
              options={startOptions(startMinutes).map((minutes) => ({
                value: toClock(minutes),
                label: toClock(minutes),
                keywords: timeKeywords(minutes),
              }))}
            />
          )}
        </Field>
        <Field label={t("end")} error={errorText(errors.end)} required>
          {(fieldProps) => (
            <Dropdown
              id={fieldProps.id}
              aria-invalid={fieldProps["aria-invalid"]}
              aria-describedby={fieldProps["aria-describedby"]}
              label={t("end")}
              name="end"
              value={values.end}
              onChange={set("end")}
              placeholder={t("pickTime")}
              numeric
              className="w-full"
              options={
                startMinutes === null
                  ? []
                  : endOptions(startMinutes, endMinutes).map((option) => ({
                      value: toClock(option.minutes),
                      label: toClock(option.minutes),
                      keywords: timeKeywords(option.minutes),
                      hint: option.nextDay
                        ? t("nextDayHint", { duration: describeDuration(option.duration) })
                        : describeDuration(option.duration),
                    }))
              }
            />
          )}
        </Field>
      </div>

      <p aria-live="polite" className="min-h-5 text-sm text-ink-muted">
        {preview?.ok &&
          `${
            pausedMinutes > 0
              ? t("lastsWithPauses", {
                  duration: describeDuration(Math.max(0, preview.minutes - pausedMinutes)),
                  pauses: describeDuration(pausedMinutes),
                })
              : t("lasts", { duration: describeDuration(preview.minutes) })
          }${crossesMidnight ? ` · ${t("nextDay")}` : ""}`}
      </p>

      {errors.form && (
        <p role="alert" className="rounded-tile bg-warn/10 px-4 py-3 text-sm text-warn">
          {errorText(errors.form)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-tile px-4 py-2.5 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          aria-disabled={pending}
          className="rounded-tile bg-accent px-4 py-2.5 font-display text-sm font-medium text-on-accent transition-opacity duration-150 ease-signature hover:opacity-90 aria-disabled:cursor-wait aria-disabled:opacity-60 motion-reduce:transition-none"
        >
          {pending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
