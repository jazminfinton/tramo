import type { ProjectRole } from "@/generated/prisma/enums";

/**
 * The admin board's optimistic state: a change is shown immediately and the
 * server's answer (via refresh) replaces it. Pure, so it's tested on its own.
 */

export type BoardMember = { userId: string; name: string; role: ProjectRole };

export type BoardProjectState = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  members: BoardMember[];
};

export type BoardChange =
  | { type: "assign"; projectId: string; member: BoardMember }
  | { type: "remove"; projectId: string; userId: string };

export function applyBoardChange(projects: BoardProjectState[], change: BoardChange): BoardProjectState[] {
  return projects.map((project) => {
    if (project.id !== change.projectId) return project;

    if (change.type === "remove") {
      return { ...project, members: project.members.filter((member) => member.userId !== change.userId) };
    }

    const exists = project.members.some((member) => member.userId === change.member.userId);
    return {
      ...project,
      members: exists
        ? project.members.map((member) => (member.userId === change.member.userId ? change.member : member))
        : [...project.members, change.member],
    };
  });
}
