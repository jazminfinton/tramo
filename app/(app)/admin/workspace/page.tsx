import { getTranslations } from "next-intl/server";

import { AdminNav } from "@/components/global/admin-nav";
import { WorkspaceForm } from "@/features/workspace/components/workspace-form";
import { requireAdmin } from "@/lib/dal";

export default async function WorkspaceAdminPage() {
  const { workspace } = await requireAdmin();
  const t = await getTranslations("workspace");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <AdminNav current="workspace" />
      <header className="flex flex-col gap-1">
        <h1 className="poster text-6xl uppercase sm:text-7xl">{t("title")}</h1>
        <p className="text-sm text-ink-muted">{t("subtitle")}</p>
      </header>
      <WorkspaceForm name={workspace.name} />
    </main>
  );
}
