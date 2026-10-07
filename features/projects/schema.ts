import { z } from "zod";

import { METRIC_LEADS, METRIC_RANGES } from "@/lib/metric-views";
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
  // What Metrics opens with for this project: one of the preset periods, and
  // the metric that goes first.
  metricsRange: z.enum(METRIC_RANGES, { error: "invalidMetricsRange" }),
  metricsLead: z.enum(METRIC_LEADS, { error: "invalidMetricsLead" }),
});

/** A form's fields. The create form only sends a name: the rest stays undefined. */
export function projectFromForm(formData: FormData) {
  return {
    name: formData.get("name"),
    color: formData.get("color") ?? undefined,
    metricsRange: formData.get("metricsRange") ?? undefined,
    metricsLead: formData.get("metricsLead") ?? undefined,
  };
}
