"use server";

import { refresh } from "next/cache";

import { workspaceFromForm, workspaceNameSchema } from "@/features/workspace/schema";
import { renameWorkspace } from "@/features/workspace/workspace";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { parse, type ActionResult } from "@/lib/form";

export async function renameWorkspaceAction(formData: FormData): Promise<ActionResult> {
  const { workspace } = await requireAdmin();
  const parsed = parse(workspaceNameSchema, workspaceFromForm(formData));
  if (!parsed.ok) return parsed.result;

  const result = await renameWorkspace(prisma, workspace.id, parsed.data.name);
  if (!result.ok) return { error: result.reason };

  refresh();
  return { ok: true };
}
