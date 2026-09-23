import { describe, expect, it } from "vitest";

import { planAccess, type AccessState } from "@/lib/access/plan";

const base: AccessState = {
  isBootstrapAdmin: false,
  defaultWorkspaceId: "ws-1",
  memberships: [],
  invitations: [],
};

describe("planAccess: bootstrap admins (ADMIN_EMAILS)", () => {
  it("creates the first workspace when none exists", () => {
    expect(planAccess({ ...base, isBootstrapAdmin: true, defaultWorkspaceId: null })).toEqual([
      { kind: "createWorkspaceAsAdmin" },
    ]);
  });

  it("becomes an active admin of the default workspace", () => {
    expect(planAccess({ ...base, isBootstrapAdmin: true })).toEqual([
      { kind: "grantAdmin", workspaceId: "ws-1" },
    ]);
  });

  it("is promoted even if an earlier request was pending or rejected", () => {
    for (const status of ["PENDING", "REJECTED"] as const) {
      const state: AccessState = {
        ...base,
        isBootstrapAdmin: true,
        memberships: [{ workspaceId: "ws-1", role: "MEMBER", status }],
      };
      expect(planAccess(state)).toEqual([{ kind: "grantAdmin", workspaceId: "ws-1" }]);
    }
  });

  it("does nothing once already an active admin", () => {
    const state: AccessState = {
      ...base,
      isBootstrapAdmin: true,
      memberships: [{ workspaceId: "ws-1", role: "ADMIN", status: "ACTIVE" }],
    };
    expect(planAccess(state)).toEqual([]);
  });
});

describe("planAccess: invitations", () => {
  it("accepts an open invitation with its role", () => {
    const state: AccessState = {
      ...base,
      invitations: [{ id: "inv-1", workspaceId: "ws-1", role: "MEMBER" }],
    };
    expect(planAccess(state)).toEqual([
      { kind: "acceptInvitation", invitationId: "inv-1", workspaceId: "ws-1", role: "MEMBER" },
    ]);
  });

  it("activates a pending or rejected member who gets invited", () => {
    const state: AccessState = {
      ...base,
      memberships: [{ workspaceId: "ws-1", role: "MEMBER", status: "REJECTED" }],
      invitations: [{ id: "inv-1", workspaceId: "ws-1", role: "ADMIN" }],
    };
    expect(planAccess(state)).toEqual([
      { kind: "acceptInvitation", invitationId: "inv-1", workspaceId: "ws-1", role: "ADMIN" },
    ]);
  });

  it("never downgrades an admin through an invitation", () => {
    const state: AccessState = {
      ...base,
      memberships: [{ workspaceId: "ws-1", role: "ADMIN", status: "ACTIVE" }],
      invitations: [{ id: "inv-1", workspaceId: "ws-1", role: "MEMBER" }],
    };
    expect(planAccess(state)).toEqual([
      { kind: "acceptInvitation", invitationId: "inv-1", workspaceId: "ws-1", role: "ADMIN" },
    ]);
  });

  it("accepts invitations to other workspaces without requesting the default one", () => {
    const state: AccessState = {
      ...base,
      invitations: [{ id: "inv-2", workspaceId: "ws-2", role: "MEMBER" }],
    };
    expect(planAccess(state)).toEqual([
      { kind: "acceptInvitation", invitationId: "inv-2", workspaceId: "ws-2", role: "MEMBER" },
    ]);
  });
});

describe("planAccess: everyone else", () => {
  it("requests access to the default workspace on first sign-in", () => {
    expect(planAccess(base)).toEqual([{ kind: "requestAccess", workspaceId: "ws-1" }]);
  });

  it("does not request again while a request exists", () => {
    for (const status of ["PENDING", "REJECTED", "ACTIVE"] as const) {
      const state: AccessState = {
        ...base,
        memberships: [{ workspaceId: "ws-1", role: "MEMBER", status }],
      };
      expect(planAccess(state)).toEqual([]);
    }
  });

  it("waits when there is no workspace yet", () => {
    expect(planAccess({ ...base, defaultWorkspaceId: null })).toEqual([]);
  });
});
