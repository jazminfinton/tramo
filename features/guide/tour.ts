import type { Route } from "next";

import type { ProjectPersona } from "@/lib/access/permissions";

/**
 * The guided tour: which steps each person gets, and where they left it.
 *
 * Each step lives on a page and points at an element marked with a
 * `data-tour` key. The tour walks through the real screens, so what it
 * points at is exactly what the person will touch later.
 */

export type TourStepId =
  | "welcome"
  | "welcomeObserver"
  | "welcomeUnassigned"
  | "welcomeAdmin"
  | "timer"
  | "popOut"
  | "recent"
  | "weekAdd"
  | "weekTeam"
  | "observerHome"
  | "teamWeek"
  | "metrics"
  | "invite"
  | "board"
  | "settings"
  | "help";

export type TourStep = {
  id: TourStepId;
  /** The page the step is shown on; null keeps whatever page is on screen. */
  path: Route | null;
  /**
   * `data-tour` keys of what the step points at, by preference: the first
   * visible one wins (the header's help button, else the phone's menu). With
   * none, or none on screen, the card shows centered.
   */
  targets: string[];
};

const step = (id: TourStepId, path: Route | null, ...targets: string[]): TourStep => ({ id, path, targets });

const TRACKER = [
  step("welcome", "/"),
  step("timer", "/", "timer"),
  step("popOut", "/", "timer-pop-out"),
  step("recent", "/", "recent-entries"),
  step("weekAdd", "/week", "week-add"),
  step("weekTeam", "/week", "week-tabs"),
];
const OBSERVER = [
  step("welcomeObserver", "/"),
  step("observerHome", "/", "observer-home"),
  step("teamWeek", "/week", "team-blocks"),
];
const METRICS = step("metrics", "/metrics", "metrics-filters");
const ADMIN = [step("invite", "/admin/members", "invite-form"), step("board", "/admin/projects", "projects-board")];
const END = [step("settings", "/settings", "theme-picker"), step("help", null, "help-button", "nav-menu")];

/** The tour for a person, by how they take part in projects and whether they run the workspace. */
export function tourSteps({ persona, isAdmin }: { persona: ProjectPersona; isAdmin: boolean }): TourStep[] {
  const admin = isAdmin ? ADMIN : [];
  switch (persona) {
    case "tracker":
      return [...TRACKER, METRICS, ...admin, ...END];
    case "observer":
      return [...OBSERVER, METRICS, ...admin, ...END];
    case "unassigned":
      return isAdmin ? [step("welcomeAdmin", "/"), ...ADMIN, METRICS, ...END] : [step("welcomeUnassigned", "/"), ...END];
  }
}

/**
 * Where a person stands with the tour, from the step saved on their account:
 * never touched it (null: it starts on its own), left it on a step, or
 * finished it (saved past the last step).
 */
export function tourStatus(saved: number | null, length: number): "new" | "paused" | "done" {
  if (saved === null) return "new";
  return saved >= length ? "done" : "paused";
}

/** The step to open: where it was left, or the start when it's new or done. */
export function resumeIndex(saved: number | null, length: number): number {
  if (saved === null || saved < 0 || saved >= length) return 0;
  return saved;
}
