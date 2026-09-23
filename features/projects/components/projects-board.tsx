"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useOptimistic, useState, useTransition } from "react";

import { Avatar } from "@/components/common/avatar";
import { assignToProjectAction, removeFromProjectAction, setProjectArchivedAction } from "@/features/projects/actions";
import { applyBoardChange, type BoardChange, type BoardProjectState } from "@/features/projects/board-state";
import { ProjectCard } from "@/features/projects/components/project-card";
import { BUTTON_GHOST } from "@/features/projects/components/styles";
import type { BoardPerson } from "@/features/projects/queries";
import type { ProjectRole } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/form";

const personId = (id: UniqueIdentifier) => String(id).replace(/^person:/, "");
const projectId = (id: UniqueIdentifier) => String(id).replace(/^project:/, "");

function PersonChip({ person, lifted = false }: { person: BoardPerson; lifted?: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 rounded-pill bg-raised py-1 pr-3 pl-1 text-sm ${
        lifted ? "shadow-lg shadow-black/30" : ""
      }`}
    >
      <Avatar name={person.name} size="sm" />
      {person.name}
      <GripVertical className="icon size-3.5 text-ink-dim" aria-hidden />
    </span>
  );
}

function DraggablePerson({ person, roleDescription }: { person: BoardPerson; roleDescription: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `person:${person.id}`,
    attributes: { roleDescription },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      // Lets a touch scroll the page until the long-press activates dragging.
      style={{ touchAction: "manipulation" }}
      className={`rounded-pill ${isDragging ? "opacity-40" : ""}`}
    >
      <PersonChip person={person} />
    </button>
  );
}

/**
 * The assignment board: drag a person onto a project to make them a tracker
 * there, or use each card's "Assign" dialog — the path that needs no dragging
 * (WCAG 2.2 SC 2.5.7) and works the same with keyboard and screen readers.
 *
 * Changes show instantly (useOptimistic) and the server's answer replaces
 * them on refresh; a refused change simply reverts and shows why.
 */
export function ProjectsBoard({ projects, people }: { projects: BoardProjectState[]; people: BoardPerson[] }) {
  const t = useTranslations("projects");
  const dndId = useId();
  const [optimistic, applyOptimistic] = useOptimistic(projects, applyBoardChange);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<BoardPerson | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const personById = new Map(people.map((person) => [person.id, person]));
  const projectById = new Map(optimistic.map((project) => [project.id, project]));
  const nameOf = (id: UniqueIdentifier) => personById.get(personId(id))?.name ?? "";
  const projectNameOf = (id: UniqueIdentifier | undefined) =>
    id === undefined ? "" : (projectById.get(projectId(id))?.name ?? "");

  function mutate(change: BoardChange, action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      applyOptimistic(change);
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  function assign(targetProjectId: string, userId: string, role: ProjectRole) {
    const person = personById.get(userId);
    if (!person) return;
    mutate({ type: "assign", projectId: targetProjectId, member: { userId, name: person.name, role } }, () =>
      assignToProjectAction(targetProjectId, userId, role),
    );
  }

  function remove(targetProjectId: string, userId: string) {
    mutate({ type: "remove", projectId: targetProjectId, userId }, () =>
      removeFromProjectAction(targetProjectId, userId),
    );
  }

  function handleDragStart({ active }: DragStartEvent) {
    setDragging(personById.get(personId(active.id)) ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragging(null);
    if (!over) return;

    const userId = personId(active.id);
    const project = projectById.get(projectId(over.id));
    if (!project || project.members.some((member) => member.userId === userId)) return;

    assign(project.id, userId, "TRACKER");
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => t("dnd.picked", { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("dnd.over", { name: nameOf(active.id), project: projectNameOf(over.id) })
        : t("dnd.notOver", { name: nameOf(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? t("dnd.dropped", { name: nameOf(active.id), project: projectNameOf(over.id) })
        : t("dnd.cancelled", { name: nameOf(active.id) }),
    onDragCancel: ({ active }) => t("dnd.cancelled", { name: nameOf(active.id) }),
  };

  const active = optimistic.filter((project) => !project.archived);
  const archived = optimistic.filter((project) => project.archived);

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t("dnd.instructions") } }}
    >
      <div className="flex flex-col gap-8">
        {error && (
          <p role="alert" className="rounded-tile bg-warn/10 px-4 py-3 text-sm text-warn">
            {t(`errors.${error as "generic"}`)}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-xs tracking-widest text-ink-dim uppercase">{t("people.title")}</h2>
            <p className="text-xs text-ink-dim">{t("people.hint")}</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {people.map((person) => (
              <li key={person.id}>
                <DraggablePerson person={person} roleDescription={t("dnd.roleDescription")} />
              </li>
            ))}
          </ul>
        </section>

        {active.length === 0 ? (
          <p className="panel grain p-5 text-sm text-ink-muted">{t("emptyProjects")}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((project) => (
              <ProjectCard key={project.id} project={project} people={people} onAssign={assign} onRemove={remove} />
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xs tracking-widest text-ink-dim uppercase">{t("archived.title")}</h2>
            <ul className="panel grain flex flex-col">
              {archived.map((project) => (
                <li key={project.id} className="flex items-center gap-3 px-4 py-3 not-first:hairline-t">
                  <span
                    aria-hidden
                    className="size-3 flex-none rounded-full opacity-60"
                    style={{ backgroundColor: `var(--color-project-${project.color})` }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{project.name}</span>
                  <button
                    type="button"
                    aria-disabled={pending}
                    className={BUTTON_GHOST}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await setProjectArchivedAction(project.id, false);
                        if (result?.error) setError(result.error);
                      })
                    }
                  >
                    {t("card.restore")}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <DragOverlay dropAnimation={null}>{dragging ? <PersonChip person={dragging} lifted /> : null}</DragOverlay>
    </DndContext>
  );
}
