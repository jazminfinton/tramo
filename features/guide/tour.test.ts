import { describe, expect, it } from "vitest";

import { resumeIndex, tourStatus, tourSteps } from "@/features/guide/tour";

const ids = (...args: Parameters<typeof tourSteps>) => tourSteps(...args).map((step) => step.id);

describe("tourSteps", () => {
  it("walks a tracker from the timer to their week, metrics and settings", () => {
    expect(ids({ persona: "tracker", isAdmin: false })).toEqual([
      "welcome",
      "timer",
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
