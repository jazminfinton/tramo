import { describe, expect, it } from "vitest";

import { signInErrorKey } from "@/features/auth/errors";

describe("signInErrorKey", () => {
  it("shows nothing without an error", () => {
    expect(signInErrorKey(undefined)).toBeNull();
    expect(signInErrorKey("")).toBeNull();
  });

  it("recognizes a cancelled Google sign-in", () => {
    expect(signInErrorKey("access_denied")).toBe("cancelled");
  });

  it("maps anything else to a generic message, never echoing the URL", () => {
    expect(signInErrorKey("<script>alert(1)</script>")).toBe("generic");
    expect(signInErrorKey("constructor")).toBe("generic");
  });
});
