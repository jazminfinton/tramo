"use server";

import { refresh } from "next/cache";

import {
  assignToProject,
  createProject,
  removeFromProject,
  setProjectArchived,
  updateProject,
  type ProjectResult,
} from "@/features/projects/projects";
import {
  createProjectSchema,
  projectFromForm,
  projectRoleSchema,
  updateProjectSchema,
} from "@/features/projects/schema";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { parse, type ActionResult } from "@/lib/form";

// Admin-only: each action checks access first, validates its (untrusted)
// arguments, and the domain functions scope every query to the admin's workspace.

function settle(result: ProjectResult): ActionResult {
  if (!result.ok) return { error: result.reason };
  refresh();
  return { ok: true };
}

export async function createProjectAction(formData: FormData): Promise<ActionResult> {
  const { workspace, user } = await requireAdmin();
  const parsed = parse(createProjectSchema, projectFromForm(formData));
  if (!parsed.ok) return parsed.result;

  const result = await createProject(prisma, {
    workspaceId: workspace.id,
    creatorId: user.id,
    name: parsed.data.name,
  });
  if (!result.ok) return { fieldErrors: { name: result.reason } };

  refresh();
  return { ok: true };
}

export async function updateProjectAction(projectId: string, formData: FormData): Promise<ActionResult> {
  const { workspace } = await requireAdmin();
  const parsed = parse(updateProjectSchema, projectFromForm(formData));
  if (!parsed.ok) return parsed.result;

  const result = await updateProject(prisma, workspace.id, String(projectId), parsed.data);
  if (!result.ok && result.reason === "nameTaken") return { fieldErrors: { name: result.reason } };
  return settle(result);
}

export async function setProjectArchivedAction(projectId: string, archived: boolean): Promise<ActionResult> {
  const { workspace } = await requireAdmin();
  return settle(await setProjectArchived(prisma, workspace.id, String(projectId), archived === true));
}

export async function assignToProjectAction(
  projectId: string,
  userId: string,
  role: string,
): Promise<ActionResult> {
  const { workspace } = await requireAdmin();
  const parsed = projectRoleSchema.safeParse(role);
  if (!parsed.success) return { error: "invalidRole" };
  return settle(await assignToProject(prisma, workspace.id, String(projectId), String(userId), parsed.data));
}

export async function removeFromProjectAction(projectId: string, userId: string): Promise<ActionResult> {
  const { workspace } = await requireAdmin();
  return settle(await removeFromProject(prisma, workspace.id, String(projectId), String(userId)));
}
