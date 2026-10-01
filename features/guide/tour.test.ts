import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resumeIndex, tourStatus, tourSteps } from "@/features/guide/tour";

const ids = (...args: Parameters<typeof tourSteps>) => tourSteps(...args).map((step) => step.id);

const EVERYONE = (["tracker", "observer", "unassigned"] as const).flatMap((persona) => [
  { persona, isAdmin: false },
  { persona, isAdmin: true },
]);

/** Every `data-tour` key the screens mark, read from their source. */
function markedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const folder of ["app", "components", "features"]) {
    const root = path.resolve(process.cwd(), folder);
    for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (!file.endsWith(".tsx")) continue;
      const source = readFileSync(path.join(root, file), "utf8");
      for (const [, value = ""] of source.matchAll(/data-tour="([^"]+)"/g)) {
        for (const key of value.split(/\s+/)) keys.add(key);
      }
    }
  }
  return keys;
}

describe("tourSteps", () => {
  it("walks a tracker from the timer and the team's tasks to their week, metrics and settings", () => {
    expect(ids({ persona: "tracker", isAdmin: false })).toEqual([
      "welcome",
      "timer",
      "tasks",
      "popOut",
      "recent",
      "weekAdd",
      "weekTeam",
      "metrics",
      "settings",
      "help",
    ]);
  });

  it("adds inviting people and the projects board for admins", () => {
    expect(ids({ persona: "tracker", isAdmin: true })).toEqual([
      "welcome",
      "timer",
      "tasks",
      "popOut",
      "recent",
      "weekAdd",
      "weekTeam",
      "metrics",
      "invite",
      "board",
      "settings",
      "help",
    ]);
  });

  it("shows an observer what they follow instead of the timer", () => {
    expect(ids({ persona: "observer", isAdmin: false })).toEqual([
      "welcomeObserver",
      "observerHome",
      "teamWeek",
      "metrics",
      "settings",
      "help",
    ]);
  });

  it("keeps it short for someone without projects yet", () => {
    expect(ids({ persona: "unassigned", isAdmin: false })).toEqual(["welcomeUnassigned", "settings", "help"]);
    expect(ids({ persona: "unassigned", isAdmin: true })).toEqual([
      "welcomeAdmin",
      "invite",
      "board",
      "metrics",
      "settings",
      "help",
    ]);
  });

  it("shows the team's tasks right where they're picked, in the timer", () => {
    const steps = tourSteps({ persona: "tracker", isAdmin: false });

    expect(steps.find((step) => step.id === "tasks")).toEqual({ id: "tasks", path: "/", targets: ["timer-task"] });
  });

  it("only points at things a screen marks", () => {
    const marked = markedKeys();
    const targets = new Set(EVERYONE.flatMap((who) => tourSteps(who).flatMap((step) => step.targets)));

    expect([...targets].filter((key) => !marked.has(key))).toEqual([]);
  });

  it("starts every tour at home, and ends it where the person is, on the help button", () => {
    for (const persona of ["tracker", "observer", "unassigned"] as const) {
      const steps = tourSteps({ persona, isAdmin: false });
      expect(steps[0]).toMatchObject({ path: "/", targets: [] });
      expect(steps.at(-1)).toMatchObject({ id: "help", path: null, targets: ["help-button", "nav-menu"] });
    }
  });
});

describe("tourStatus", () => {
  it("is new until the person touches the tour", () => {
    expect(tourStatus(null, 9)).toBe("new");
  });

  it("is paused anywhere before the end, and done past it", () => {
    expect(tourStatus(0, 9)).toBe("paused");
    expect(tourStatus(4, 9)).toBe("paused");
    expect(tourStatus(9, 9)).toBe("done");
    expect(tourStatus(12, 9)).toBe("done");
  });
});

describe("resumeIndex", () => {
  it("picks up where it was left", () => {
    expect(resumeIndex(4, 9)).toBe(4);
  });

  it("starts over when it's new or finished", () => {
    expect(resumeIndex(null, 9)).toBe(0);
    expect(resumeIndex(9, 9)).toBe(0);
  });

  it("stays inside a tour that got shorter", () => {
    expect(resumeIndex(-3, 6)).toBe(0);
  });
});
