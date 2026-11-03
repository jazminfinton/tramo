import { describe, expect, it } from "vitest";

import {
  entryFormSchema,
  entryFromForm,
  paidDaySchema,
  paidEntrySchema,
  paidRangeSchema,
  setPaidRangeSchema,
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

describe("paidRangeSchema", () => {
  const range = { from: "2026-09-01", to: "2026-09-30", projectId: null, personId: null };

  it("takes two days in order, with a project and a person or without them", () => {
    expect(paidRangeSchema.parse(range)).toEqual(range);
    expect(paidRangeSchema.parse({ ...range, projectId: "p1" }).projectId).toBe("p1");
    expect(paidRangeSchema.parse({ ...range, personId: "u1" }).personId).toBe("u1");
    expect(paidRangeSchema.parse({ ...range, to: "2026-09-01" }).to).toBe("2026-09-01");
  });

  it("takes a year at most", () => {
    expect(paidRangeSchema.safeParse({ ...range, from: "2026-01-01", to: "2027-01-01" }).success).toBe(true);
    expect(paidRangeSchema.safeParse({ ...range, from: "2026-01-01", to: "2027-01-02" }).success).toBe(false);
  });

  it("refuses what doesn't make a range", () => {
    for (const input of [
      { ...range, from: "2026-09-30", to: "2026-09-01" },
      { ...range, from: "2026-02-30" },
      { ...range, to: "30/09/2026" },
      { ...range, projectId: "" },
      { ...range, projectId: "p".repeat(65) },
      { ...range, personId: "" },
      { ...range, personId: "u".repeat(65) },
      { from: range.from, to: range.to, projectId: null },
      { from: range.from, to: range.to, personId: null },
    ]) {
      expect(paidRangeSchema.safeParse(input).success, JSON.stringify(input)).toBe(false);
    }
  });
});

describe("setPaidRangeSchema", () => {
  const range = { from: "2026-09-01", to: "2026-09-30", projectId: null, personId: null };

  it("takes a range and whether it's paid", () => {
    expect(setPaidRangeSchema.parse({ ...range, paid: false })).toEqual({ ...range, paid: false });
  });

  it("refuses a range that isn't one, or no answer", () => {
    expect(setPaidRangeSchema.safeParse({ ...range, from: "2026-09-30", to: "2026-09-01", paid: true }).success).toBe(false);
    expect(setPaidRangeSchema.safeParse(range).success).toBe(false);
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
