"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmButton } from "@/components/common/confirm-dialog";
import { deleteEntryAction } from "@/features/time/entry-actions";
import {
  EntryDialog,
  type EditableEntry,
  type EntryDialogProject,
} from "@/features/time/components/entry-dialog";

type Shared = {
  projects: EntryDialogProject[];
  suggestions: Record<string, string[]>;
  timeZone: string;
};

/** Opens the dialog to add a block by hand. */
export function AddEntryButton(props: Shared) {
  const t = useTranslations("entries");
  const [open, setOpen] = useState(false);

  if (props.projects.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-tile bg-raised px-3 py-1.5 font-display text-sm transition-colors duration-150 ease-signature hover:bg-tile motion-reduce:transition-none"
      >
        <Plus className="icon size-4" aria-hidden />
        {t("add")}
      </button>
      <EntryDialog open={open} onClose={() => setOpen(false)} {...props} />
    </>
  );
}

const ICON_BUTTON =
  "flex size-8 items-center justify-center rounded-full text-ink-dim transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none";

/** Edit and delete for one block. */
export function EntryRowActions({ entry, label, ...shared }: Shared & { entry: EditableEntry; label: string }) {
  const t = useTranslations("entries");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-none items-center">
      <button type="button" aria-label={t("editLabel", { entry: label })} onClick={() => setOpen(true)} className={ICON_BUTTON}>
        <Pencil className="icon size-4" aria-hidden />
      </button>
      <ConfirmButton
        className={ICON_BUTTON}
        label={t("deleteLabel", { entry: label })}
        dialogTitle={t("deleteTitle")}
        description={t("deleteBody", { entry: label })}
        confirmLabel={t("deleteConfirm")}
        tone="danger"
        onConfirm={() => deleteEntryAction(entry.id)}
        translateError={(key) => t(`errors.${key as "generic"}`)}
      >
        <Trash2 className="icon size-4" aria-hidden />
      </ConfirmButton>
      <EntryDialog open={open} onClose={() => setOpen(false)} entry={entry} {...shared} />
    </div>
  );
}
