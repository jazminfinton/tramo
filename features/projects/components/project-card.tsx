"use client";

import { useDroppable } from "@dnd-kit/core";
import { Pencil, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar } from "@/components/common/avatar";
import { ConfirmButton } from "@/components/common/confirm-dialog";
import { RadioGroup } from "@/components/common/radio-group";
import { setProjectArchivedAction } from "@/features/projects/actions";
import type { BoardProjectState } from "@/features/projects/board-state";
import { AssignDialog } from "@/features/projects/components/assign-dialog";
import { EditProjectDialog } from "@/features/projects/components/edit-project-dialog";
import { BUTTON_GHOST, BUTTON_SECONDARY, SEGMENT } from "@/features/projects/components/styles";
import type { BoardPerson } from "@/features/projects/queries";
import { PROJECT_ROLES } from "@/features/projects/schema";
import type { ProjectRole } from "@/generated/prisma/enums";

type ProjectCardProps = {
  project: BoardProjectState;
  people: BoardPerson[];
  onAssign: (projectId: string, userId: string, role: ProjectRole) => void;
  onRemove: (projectId: string, userId: string) => void;
};

/** A project as a drop target, with its people, their roles and the project's actions. */
export function ProjectCard({ project, people, onAssign, onRemove }: ProjectCardProps) {
  const t = useTranslations("projects");
  const { setNodeRef, isOver } = useDroppable({ id: `project:${project.id}`, data: { projectId: project.id } });
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const assignedIds = new Set(project.members.map((member) => member.userId));
  const unassigned = people.filter((person) => !assignedIds.has(person.id));

  return (
    <article
      ref={setNodeRef}
      aria-label={project.name}
      className={`panel grain flex flex-col gap-4 p-4 outline-offset-2 transition-[outline-color] duration-150 ease-signature motion-reduce:transition-none ${
        isOver ? "outline-2 outline-accent" : "outline-2 outline-transparent"
      }`}
    >
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          className="size-3 flex-none rounded-full"
          style={{ backgroundColor: `var(--color-project-${project.color})` }}
        />
        <h3 className="truncate font-display text-sm font-medium">{project.name}</h3>
        <span className="ml-auto flex-none text-xs text-ink-dim">
          {t("card.members", { count: project.members.length })}
        </span>
      </header>

      {project.members.length === 0 ? (
        <p className="text-sm text-ink-dim">{t("card.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {project.members.map((member) => (
            <li key={member.userId} className="flex items-center gap-2 rounded-tile bg-raised px-2 py-1.5">
              <Avatar name={member.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
              <RadioGroup
                label={t("card.roleLabel", { name: member.name, project: project.name })}
                value={member.role}
                options={PROJECT_ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) }))}
                onChange={(role) => onAssign(project.id, member.userId, role)}
                className="inline-flex flex-none gap-0.5 rounded-[6px] bg-surface p-0.5"
                optionClassName={SEGMENT}
                renderOption={(option) => option.label}
              />
              <button
                type="button"
                aria-label={t("card.remove", { name: member.name })}
                onClick={() => onRemove(project.id, member.userId)}
                className="flex size-7 flex-none items-center justify-center rounded-full text-ink-dim transition-colors duration-150 ease-signature hover:bg-tile hover:text-ink motion-reduce:transition-none"
              >
                <X className="icon size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-auto flex flex-wrap gap-2">
        <button type="button" onClick={() => setAssignOpen(true)} className={BUTTON_SECONDARY}>
          <UserPlus className="icon size-4" aria-hidden />
          {t("card.assign")}
        </button>
        <button type="button" onClick={() => setEditOpen(true)} className={BUTTON_GHOST}>
          <Pencil className="icon size-4" aria-hidden />
          {t("card.edit")}
        </button>
        <ConfirmButton
          className={BUTTON_GHOST}
          dialogTitle={t("archiveDialog.title", { project: project.name })}
          description={t("archiveDialog.body")}
          confirmLabel={t("archiveDialog.confirm")}
          onConfirm={() => setProjectArchivedAction(project.id, true)}
          translateError={(key) => t(`errors.${key as "generic"}`)}
        >
          {t("card.archive")}
        </ConfirmButton>
      </footer>

      <AssignDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        projectName={project.name}
        people={unassigned}
        onAssign={(userId, role) => onAssign(project.id, userId, role)}
      />
      <EditProjectDialog open={editOpen} onClose={() => setEditOpen(false)} project={project} />
    </article>
  );
}
