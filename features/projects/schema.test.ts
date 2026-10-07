import { describe, expect, it } from "vitest";

import { projectFromForm, updateProjectSchema } from "@/features/projects/schema";
import { toFieldErrors } from "@/lib/form";

const valid = { name: "Soporte", color: "blue", metricsRange: "week", metricsLead: "tasks" };

const errorsOf = (input: Record<string, unknown>) => {
  const result = updateProjectSchema.safeParse(input);
  return result.success ? {} : toFieldErrors(result.error);
};

describe("updateProjectSchema", () => {
  it("takes a name, a color and what the project's metrics open with", () => {
    expect(updateProjectSchema.parse({ ...valid, name: "  Soporte " })).toEqual(valid);
  });

  it("refuses a period that isn't one of the presets", () => {
    expect(errorsOf({ ...valid, metricsRange: "custom" })).toEqual({ metricsRange: "invalidMetricsRange" });
    expect(errorsOf({ ...valid, metricsRange: undefined })).toEqual({ metricsRange: "invalidMetricsRange" });
  });

  it("refuses a metric that isn't on offer", () => {
    expect(errorsOf({ ...valid, metricsLead: "projects" })).toEqual({ metricsLead: "invalidMetricsLead" });
  });
});

describe("projectFromForm", () => {
  it("reads every field of the edit form", () => {
    const formData = new FormData();
    for (const [name, value] of Object.entries(valid)) formData.set(name, value);

    expect(updateProjectSchema.parse(projectFromForm(formData))).toEqual(valid);
  });

  it("leaves out what a shorter form doesn't send", () => {
    const formData = new FormData();
    formData.set("name", "Soporte");

    expect(projectFromForm(formData)).toMatchObject({ name: "Soporte", metricsRange: undefined, metricsLead: undefined });
  });
});
