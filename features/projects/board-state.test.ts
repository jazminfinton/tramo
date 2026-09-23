import { describe, expect, it } from "vitest";

import { applyBoardChange, type BoardProjectState } from "@/features/projects/board-state";

const board: BoardProjectState[] = [
  { id: "p1", name: "Fragua", color: "blue", archived: false, members: [{ userId: "u1", name: "Ana", role: "TRACKER" }] },
  { id: "p2", name: "Horas", color: "orange", archived: false, members: [] },
];

describe("applyBoardChange", () => {
  it("adds a person to a project", () => {
    const next = applyBoardChange(board, {
      type: "assign",
      projectId: "p2",
      member: { userId: "u2", name: "Beto", role: "VIEWER" },
    });

    expect(next[1]?.members).toEqual([{ userId: "u2", name: "Beto", role: "VIEWER" }]);
    expect(next[0]).toBe(board[0]);
  });

  it("changes the role of someone already assigned", () => {
    const next = applyBoardChange(board, {
      type: "assign",
      projectId: "p1",
      member: { userId: "u1", name: "Ana", role: "VIEWER" },
    });

    expect(next[0]?.members).toEqual([{ userId: "u1", name: "Ana", role: "VIEWER" }]);
  });

  it("removes a person from a project", () => {
    const next = applyBoardChange(board, { type: "remove", projectId: "p1", userId: "u1" });

    expect(next[0]?.members).toEqual([]);
  });

  it("never mutates the input", () => {
    applyBoardChange(board, { type: "remove", projectId: "p1", userId: "u1" });

    expect(board[0]?.members).toHaveLength(1);
  });
});
