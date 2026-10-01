"use client";

import { Check, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";

import { Dropdown } from "@/components/common/dropdown";
import { FIELD } from "@/components/common/field";
import { createTaskAction } from "@/features/time/task-actions";
import { TASK_NAME_MAX, taskNameKey, tidyTaskName } from "@/features/time/task-text";
import type { SharedTask } from "@/features/time/tasks";

type TaskPickerProps = {
  /** The workspace's shared tasks. */
  tasks: SharedTask[];
  /** The picked task's id, or "" for none. */
  value: string;
  onChange: (task: SharedTask | null) => void;
  /** With a name, the picked id travels in a hidden input, like any form field. */
  name?: string;
  /** Marks the picker for the guided tour (features/guide/tour.ts). */
  "data-tour"?: string;
  className?: string;
};

// The option that opens the field for a new task. No task has this id.
const NEW_TASK = "+new";

const ICON_BUTTON =
  "flex size-10 flex-none items-center justify-center rounded-full transition-colors duration-150 ease-signature hover:bg-raised aria-disabled:cursor-wait aria-disabled:opacity-60 motion-reduce:transition-none";

/**
 * Picks one of the workspace's shared tasks, or none, and adds a new one
 * without leaving the form: "new task" turns the list into a text field.
 * There, Enter adds the task and picks it, and Escape goes back to the list.
 *
 * The text field isn't a form of its own, so the picker can live inside one
 * (the entry dialog): Enter in it never submits what's around.
 */
export function TaskPicker({ tasks, value, onChange, name, "data-tour": tourKey, className = "" }: TaskPickerProps) {
  const t = useTranslations("tasks");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Tasks added here that the page hasn't sent back yet.
  const [added, setAdded] = useState<SharedTask[]>([]);
  const [pending, startTransition] = useTransition();
  const triggerId = useId();
  const errorId = useId();
  const draftRef = useRef<HTMLInputElement>(null);
  const cameBack = useRef(false);

  const known = new Set(tasks.map((task) => task.id));
  const all = [...tasks, ...added.filter((task) => !known.has(task.id))].sort((a, b) =>
    taskNameKey(a.name).localeCompare(taskNameKey(b.name), "es"),
  );

  // Focus follows the switch: into the text field, and back to the list.
  useEffect(() => {
    if (creating) {
      draftRef.current?.focus();
    } else if (cameBack.current) {
      cameBack.current = false;
      document.getElementById(triggerId)?.focus();
    }
  }, [creating, triggerId]);

  function leave() {
    cameBack.current = true;
    setCreating(false);
    setDraft("");
    setError(null);
  }

  function pick(next: string) {
    if (next === NEW_TASK) {
      setCreating(true);
      return;
    }
    onChange(all.find((task) => task.id === next) ?? null);
  }

  function create() {
    if (pending) return;
    const taskName = tidyTaskName(draft);
    if (!taskName) {
      setError("nameRequired");
      return;
    }

    // Already on the list, whatever its case: that's the task, no request needed.
    const existing = all.find((task) => taskNameKey(task.name) === taskNameKey(taskName));
    if (existing) {
      onChange(existing);
      leave();
      return;
    }

    startTransition(async () => {
      const result = await createTaskAction(taskName);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setAdded((current) => [...current, result.task]);
      onChange(result.task);
      leave();
    });
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      create();
    } else if (event.key === "Escape") {
      // Back to the list, without closing the dialog the picker may live in.
      event.preventDefault();
      leave();
    }
  }

  return (
    <span data-tour={tourKey} className={`flex min-w-0 flex-col gap-2 ${className}`}>
      {name !== undefined && <input type="hidden" name={name} value={value} />}

      {creating ? (
        <span className="flex items-center gap-1">
          <input
            ref={draftRef}
            type="text"
            aria-label={t("newLabel")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            autoComplete="off"
            maxLength={TASK_NAME_MAX}
            placeholder={t("newPlaceholder")}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={onDraftKeyDown}
            className={`${FIELD} min-w-0 flex-1`}
          />
          <button
            type="button"
            aria-label={t("create")}
            aria-disabled={pending}
            onClick={create}
            className={`${ICON_BUTTON} text-accent`}
          >
            <Check className="icon size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("cancel")}
            onClick={leave}
            className={`${ICON_BUTTON} text-ink-dim hover:text-ink`}
          >
            <X className="icon size-4" aria-hidden />
          </button>
        </span>
      ) : (
        <Dropdown
          id={triggerId}
          label={t("label")}
          value={value}
          onChange={pick}
          placeholder={t("none")}
          className="w-full"
          options={[
            { value: "", label: t("none") },
            {
              value: NEW_TASK,
              label: t("new"),
              icon: <Plus className="icon size-4 flex-none text-accent" aria-hidden />,
            },
            ...all.map((task) => ({ value: task.id, label: task.name })),
          ]}
        />
      )}

      {error && (
        <p id={errorId} role="alert" className="text-xs text-warn">
          {t(`errors.${error as "generic"}`)}
        </p>
      )}
    </span>
  );
}
