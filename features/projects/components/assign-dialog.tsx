"use client";

import { useTranslations } from "next-intl";

import { Avatar } from "@/components/common/avatar";
import { Modal } from "@/components/common/modal";
import { BUTTON_GHOST, BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/features/projects/components/styles";
import type { BoardPerson } from "@/features/projects/queries";
import type { ProjectRole } from "@/generated/prisma/enums";

type AssignDialogProps = {
  open: boolean;
  onClose: () => void;
  projectName: string;
  /** People not in the project yet. */
  people: BoardPerson[];
  onAssign: (userId: string, role: ProjectRole) => void;
};

/**
 * The single-pointer, keyboard-friendly way to assign people (WCAG 2.2 SC
 * 2.5.7): everything dragging does, without dragging.
 */
export function AssignDialog({ open, onClose, projectName, people, onAssign }: AssignDialogProps) {
  const t = useTranslations("projects");

  return (
    <Modal open={open} onClose={onClose} title={t("assignDialog.title", { project: projectName })}>
      {people.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("assignDialog.empty")}</p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3 rounded-tile px-2 py-2">
              <Avatar name={person.name} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{person.name}</span>
                <span className="truncate text-xs text-ink-dim">{person.email}</span>
              </div>
              <button
                type="button"
                aria-label={t("assignDialog.assignAs", { name: person.name, role: t("roles.TRACKER") })}
                onClick={() => onAssign(person.id, "TRACKER")}
                className={BUTTON_PRIMARY}
              >
                {t("roles.TRACKER")}
              </button>
              <button
                type="button"
                aria-label={t("assignDialog.assignAs", { name: person.name, role: t("roles.VIEWER") })}
                onClick={() => onAssign(person.id, "VIEWER")}
                className={BUTTON_SECONDARY}
              >
                {t("roles.VIEWER")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className={BUTTON_GHOST}>
          {t("assignDialog.close")}
        </button>
      </div>
    </Modal>
  );
}
