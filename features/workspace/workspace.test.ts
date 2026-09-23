import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { workspaceNameSchema } from "@/features/workspace/schema";
import { renameWorkspace } from "@/features/workspace/workspace";
import { createTestDb, type TestDb } from "@/lib/testing/db";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
});

describe("renameWorkspace", () => {
  it("renames the workspace", async () => {
    const workspace = await db.prisma.workspace.create({ data: { name: "Mi espacio" } });

    expect(await renameWorkspace(db.prisma, workspace.id, "AIMBIT")).toEqual({ ok: true });
    expect((await db.prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).name).toBe("AIMBIT");
  });

  it("reports a workspace that doesn't exist", async () => {
    expect(await renameWorkspace(db.prisma, "missing", "AIMBIT")).toEqual({ ok: false, reason: "notFound" });
  });
});

describe("workspaceNameSchema", () => {
  it("trims the name", () => {
    expect(workspaceNameSchema.parse({ name: "  AIMBIT  " })).toEqual({ name: "AIMBIT" });
  });

  it("refuses empty and overlong names with message keys", () => {
    expect(workspaceNameSchema.safeParse({ name: "   " }).error?.issues[0]?.message).toBe("nameRequired");
    expect(workspaceNameSchema.safeParse({ name: "x".repeat(61) }).error?.issues[0]?.message).toBe("nameTooLong");
  });
});
