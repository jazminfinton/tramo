import { describe, expect, it } from "vitest";

import { inviteFromForm, inviteSchema } from "@/features/members/schema";

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("inviteSchema", () => {
  it("normalizes the email and accepts a workspace role", () => {
    const result = inviteSchema.safeParse({ email: "  Nuevo@Gmail.com ", role: "MEMBER" });
    expect(result.success && result.data).toEqual({ email: "nuevo@gmail.com", role: "MEMBER", projects: [] });
  });

  it("rejects an invalid email with a message key", () => {
    const result = inviteSchema.safeParse({ email: "no-es-un-mail", role: "MEMBER" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("invalidEmail");
  });

  it("rejects roles outside the catalog", () => {
    const result = inviteSchema.safeParse({ email: "a@b.com", role: "OWNER" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("invalidRole");
  });

  it("reads the projects picked in the form, with their roles", () => {
    const parsed = inviteSchema.parse(
      inviteFromForm(
        form([
          ["email", " Ana@Test.dev "],
          ["role", "MEMBER"],
          ["projects", "p1:TRACKER"],
          ["projects", "p2:VIEWER"],
        ]),
      ),
    );

    expect(parsed).toEqual({
      email: "ana@test.dev",
      role: "MEMBER",
      projects: [
        { projectId: "p1", role: "TRACKER" },
        { projectId: "p2", role: "VIEWER" },
      ],
    });
  });

  it("rejects a project without a known role", () => {
    for (const value of ["p1:OWNER", "p1", ":TRACKER"]) {
      const result = inviteSchema.safeParse(
        inviteFromForm(form([["email", "ana@test.dev"], ["role", "MEMBER"], ["projects", value]])),
      );
      expect(result.success, value).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("invalidProjects");
    }
  });
});

describe("inviteFromForm", () => {
  it("reads the fields a form posts, with no projects when none were picked", () => {
    expect(inviteFromForm(form([["email", "a@b.com"], ["role", "ADMIN"]]))).toEqual({
      email: "a@b.com",
      role: "ADMIN",
      projects: [],
    });
  });
});
