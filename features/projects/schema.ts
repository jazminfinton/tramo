import { z } from "zod";

import { PROJECT_COLORS } from "@/lib/project-colors";

// Shared by the project forms and their Server Actions. Messages are keys into
// messages/<locale>.json → projects.errors.

export const PROJECT_ROLES = ["TRACKER", "VIEWER"] as const;

export const projectRoleSchema = z.enum(PROJECT_ROLES, { error: "invalidRole" });

export const projectNameSchema = z
  .string({ error: "nameRequired" })
  .trim()
  .min(1, { error: "nameRequired" })
  .max(60, { error: "nameTooLong" });

export const createProjectSchema = z.object({ name: projectNameSchema });

export const updateProjectSchema = z.object({
  name: projectNameSchema,
  color: z.enum(PROJECT_COLORS, { error: "invalidColor" }),
});

export function projectFromForm(formData: FormData) {
  return { name: formData.get("name"), color: formData.get("color") ?? undefined };
}
