import { z } from "zod";

export const DESCRIPTION_MAX = 200;

const description = z
  .string()
  .max(DESCRIPTION_MAX)
  .transform((value) => value.replace(/\s+/g, " ").trim());

/** What starting a timer needs. The description is free text, whitespace-normalized. */
export const startTimerSchema = z.object({
  projectId: z.string().min(1).max(64),
  description,
});

// The manual-entry form, shared by the dialog and its actions. Times arrive as
// the text people typed; features/time/interval.ts turns them into instants on
// both sides. Messages are keys into messages/<locale>.json → entries.errors.
export const entryFormSchema = z.object({
  projectId: z.string({ error: "projectRequired" }).min(1, { error: "projectRequired" }).max(64),
  description,
  date: z.string().max(10),
  start: z.string().max(16),
  end: z.string().max(16),
});

export function entryFromForm(formData: FormData) {
  return {
    projectId: formData.get("projectId") ?? "",
    description: formData.get("description") ?? "",
    date: formData.get("date") ?? "",
    start: formData.get("start") ?? "",
    end: formData.get("end") ?? "",
  };
}
