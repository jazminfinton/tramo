import { describe, expect, it } from "vitest";

import { entryFormSchema, entryFromForm, startTimerSchema, taskNameSchema } from "@/features/time/schema";
import { TASK_NAME_MAX } from "@/features/time/task-text";

describe("taskNameSchema", () => {
  it("tidies the name", () => {
    expect(taskNameSchema.parse("  Revisión   de código ")).toBe("Revisión de código");
  });

  it("refuses a blank name, and one past the limit", () => {
    const reason = (name: string) => taskNameSchema.safeParse(name).error?.issues[0]?.message;

    expect(reason("   ")).toBe("nameRequired");
    expect(reason("a".repeat(TASK_NAME_MAX + 1))).toBe("nameTooLong");
    expect(taskNameSchema.safeParse("a".repeat(TASK_NAME_MAX)).success).toBe(true);
  });
});

describe("startTimerSchema", () => {
  const start = (taskId?: string | null) => startTimerSchema.parse({ projectId: "p1", description: " Login ", taskId });

  it("takes a shared task, or none", () => {
    expect(start("t1")).toEqual({ projectId: "p1", taskId: "t1", description: "Login" });
    expect(start("").taskId).toBeNull();
    expect(start(null).taskId).toBeNull();
    expect(start().taskId).toBeNull();
  });
});

describe("the entry form", () => {
  const form = (fields: Record<string, string>) => {
    const formData = new FormData();
    for (const [name, value] of Object.entries(fields)) formData.set(name, value);
    return entryFormSchema.parse(entryFromForm(formData));
  };
  const block = { projectId: "p1", description: "", date: "2026-09-23", start: "09:00", end: "10:00" };

  it("reads the shared task picked in it", () => {
    expect(form({ ...block, taskId: "t1" }).taskId).toBe("t1");
  });

  it("reads no task from a blank or missing field", () => {
    expect(form({ ...block, taskId: "" }).taskId).toBeNull();
    expect(form(block).taskId).toBeNull();
  });
});
