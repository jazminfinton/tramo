import { z } from "zod";

// Shared by the invite form and its Server Action (see lib/form.ts). Messages
// are keys into messages/<locale>.json → members.errors.

export const WORKSPACE_ROLES = ["ADMIN", "MEMBER"] as const;

/** Roles a person can get on a project picked in their invitation. */
export const INVITED_PROJECT_ROLES = ["TRACKER", "VIEWER"] as const;

export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES, { error: "invalidRole" });

const invitedProjectSchema = z.object({
  projectId: z.string({ error: "invalidProjects" }).min(1, { error: "invalidProjects" }),
  role: z.enum(INVITED_PROJECT_ROLES, { error: "invalidProjects" }),
});

export const inviteSchema = z.object({
  email: z
    .string({ error: "invalidEmail" })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "invalidEmail" })),
  role: workspaceRoleSchema,
  // Optional: the person can also be assigned from the projects board later.
  projects: z
    .array(invitedProjectSchema, { error: "invalidProjects" })
    .max(100, { error: "invalidProjects" })
    .default([]),
});

export type InviteInput = z.infer<typeof inviteSchema>;
export type InvitedProject = InviteInput["projects"][number];

/** Each picked project travels as one `projects` field: `<projectId>:<role>`. */
export function inviteFromForm(formData: FormData) {
  return {
    email: formData.get("email"),
    role: formData.get("role"),
    projects: formData.getAll("projects").map((value) => {
      const [projectId, role] = String(value).split(":");
      return { projectId, role };
    }),
  };
}
