import { z } from "zod";

import { TASK_NAME_MAX, tidyTaskName } from "@/features/time/task-text";

export const DESCRIPTION_MAX = 200;

const description = z
  .string()
  .max(DESCRIPTION_MAX)
  .transform((value) => value.replace(/\s+/g, " ").trim());

// The shared task picked for an entry: its id, or none. A form sends none as
// an empty field; code sends null or leaves it out.
const taskId = z
  .string()
  .max(64)
  .nullish()
  .transform((value) => value || null);

/**
 * What starting a timer needs. The description is free text,
 * whitespace-normalized; the shared task is optional.
 */
export const startTimerSchema = z.object({
  projectId: z.string().min(1).max(64),
  taskId,
  description,
});

// The manual-entry form, shared by the dialog and its actions. Times arrive as
// the text people typed; features/time/interval.ts turns them into instants on
// both sides. Messages are keys into messages/<locale>.json → entries.errors.
export const entryFormSchema = z.object({
  projectId: z.string({ error: "projectRequired" }).min(1, { error: "projectRequired" }).max(64),
  taskId,
  description,
  date: z.string().max(10),
  start: z.string().max(16),
  end: z.string().max(16),
});

export function entryFromForm(formData: FormData) {
  return {
    projectId: formData.get("projectId") ?? "",
    taskId: formData.get("taskId") ?? "",
    description: formData.get("description") ?? "",
    date: formData.get("date") ?? "",
    start: formData.get("start") ?? "",
    end: formData.get("end") ?? "",
  };
}

// A new shared task's name. It's tidied before it's measured, so the spaces
// around it don't count; the first bound only turns away absurd input.
// Messages are keys into messages/<locale>.json → tasks.errors.
export const taskNameSchema = z
  .string({ error: "nameRequired" })
  .max(TASK_NAME_MAX * 4, { error: "nameTooLong" })
  .transform(tidyTaskName)
  .pipe(z.string().min(1, { error: "nameRequired" }).max(TASK_NAME_MAX, { error: "nameTooLong" }));
