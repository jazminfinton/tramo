import { describe, expect, it } from "vitest";

import {
  accessStatus,
  canTrack,
  canViewProject,
  isAdmin,
  projectPersona,
  visibleProjectsWhere,
} from "@/lib/access/permissions";

describe("isAdmin", () => {
  it("is true only for active admins", () => {
    expect(isAdmin({ role: "ADMIN", status: "ACTIVE" })).toBe(true);
    expect(isAdmin({ role: "ADMIN", status: "PENDING" })).toBe(false);
    expect(isAdmin({ role: "MEMBER", status: "ACTIVE" })).toBe(false);
  });
});

describe("canTrack", () => {
  it("allows trackers only", () => {
    expect(canTrack("TRACKER")).toBe(true);
    expect(canTrack("VIEWER")).toBe(false);
    expect(canTrack(null)).toBe(false);
  });
});

describe("canViewProject", () => {
  const admin = { role: "ADMIN", status: "ACTIVE" } as const;
  const member = { role: "MEMBER", status: "ACTIVE" } as const;

  it("lets admins see every project", () => {
    expect(canViewProject(admin, null)).toBe(true);
  });

  it("lets members see only the projects they belong to", () => {
    expect(canViewProject(member, "VIEWER")).toBe(true);
    expect(canViewProject(member, "TRACKER")).toBe(true);
    expect(canViewProject(member, null)).toBe(false);
  });

  it("gives nothing to inactive members", () => {
    expect(canViewProject({ role: "ADMIN", status: "PENDING" }, null)).toBe(false);
    expect(canViewProject({ role: "MEMBER", status: "REJECTED" }, "TRACKER")).toBe(false);
  });
});

describe("accessStatus", () => {
  it("prefers any active membership", () => {
    expect(accessStatus(["REJECTED", "ACTIVE", "PENDING"])).toBe("active");
  });

  it("reports a pending request before a rejection", () => {
    expect(accessStatus(["REJECTED", "PENDING"])).toBe("pending");
  });

  it("reports rejected, then none", () => {
    expect(accessStatus(["REJECTED"])).toBe("rejected");
    expect(accessStatus([])).toBe("none");
  });
});

describe("projectPersona", () => {
  it("is a tracker with at least one project to log time in", () => {
    expect(projectPersona(["VIEWER", "TRACKER"])).toBe("tracker");
  });

  it("is an observer when every project is read-only", () => {
    expect(projectPersona(["VIEWER", "VIEWER"])).toBe("observer");
  });

  it("is unassigned without projects", () => {
    expect(projectPersona([])).toBe("unassigned");
  });
});

describe("visibleProjectsWhere", () => {
  it("gives admins every project of the workspace", () => {
    expect(visibleProjectsWhere({ workspaceId: "w1", userId: "u1", isAdmin: true })).toEqual({ workspaceId: "w1" });
  });

  it("gives everyone else the projects they belong to, in any role", () => {
    expect(visibleProjectsWhere({ workspaceId: "w1", userId: "u1", isAdmin: false })).toEqual({
      workspaceId: "w1",
      members: { some: { userId: "u1" } },
    });
  });
});
