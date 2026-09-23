import { z } from "zod";

// Shared by the rename form and its action. Messages are keys into
// messages/<locale>.json → workspace.errors.
export const workspaceNameSchema = z.object({
  name: z
    .string({ error: "nameRequired" })
    .trim()
    .min(1, { error: "nameRequired" })
    .max(60, { error: "nameTooLong" }),
});

export function workspaceFromForm(formData: FormData) {
  return { name: formData.get("name") };
}
