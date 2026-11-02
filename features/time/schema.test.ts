import { describe, expect, it } from "vitest";

import {
  entryFormSchema,
  entryFromForm,
  paidDaySchema,
  paidEntrySchema,
  startTimerSchema,
  taskNameSchema,
} from "@/features/time/schema";
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

describe("paidEntrySchema", () => {
  it("takes a block and whether it's paid", () => {
    expect(paidEntrySchema.parse({ entryId: "e1", paid: false })).toEqual({ entryId: "e1", paid: false });
  });

  it("refuses anything else", () => {
    for (const input of [
      { entryId: "", paid: true },
      { entryId: "e".repeat(65), paid: true },
      { entryId: 1, paid: true },
      { entryId: "e1", paid: "true" },
      { entryId: "e1" },
    ]) {
      expect(paidEntrySchema.safeParse(input).success, JSON.stringify(input)).toBe(false);
    }
  });
});

describe("paidDaySchema", () => {
  it("takes a calendar day and whether it's paid", () => {
    expect(paidDaySchema.parse({ day: "2026-09-23", paid: true })).toEqual({ day: "2026-09-23", paid: true });
  });

  it("refuses what isn't a real day", () => {
    for (const day of ["2026-02-30", "23/09/2026", "", 20260923]) {
      expect(paidDaySchema.safeParse({ day, paid: true }).success, String(day)).toBe(false);
    }
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
