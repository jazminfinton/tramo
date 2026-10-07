"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";

import { Field, FIELD, FieldGroup } from "@/components/common/field";
import { Modal } from "@/components/common/modal";
import { RadioGroup } from "@/components/common/radio-group";
import { updateProjectAction } from "@/features/projects/actions";
import { BUTTON_GHOST, BUTTON_PRIMARY } from "@/features/projects/components/styles";
import { updateProjectSchema } from "@/features/projects/schema";
import { focusFirstInvalid, toFieldErrors, type FieldErrors } from "@/lib/form";
import { METRIC_LEADS, METRIC_RANGES, type MetricLead, type MetricRange } from "@/lib/metric-views";
import { PROJECT_COLORS, isProjectColor, type ProjectColor } from "@/lib/project-colors";

type EditProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  project: { id: string; name: string; color: string; metrics: { range: MetricRange; lead: MetricLead } };
};

// The two sets of pills that say what the project's metrics open with.
const PILLS = "inline-flex w-fit max-w-full flex-wrap gap-1 rounded-tile bg-raised p-1";
const pill = (checked: boolean) =>
  `rounded-[6px] px-3 py-1.5 font-display text-sm transition-colors duration-150 ease-signature motion-reduce:transition-none ${
    checked ? "bg-tile text-ink" : "text-ink-muted hover:text-ink"
  }`;

/**
 * A project's name, its color, and what Metrics opens with when someone
 * chooses it: the period, which each viewer can still change, and the metric
 * that goes first.
 */
export function EditProjectDialog({ open, onClose, project }: EditProjectDialogProps) {
  const t = useTranslations("projects");
  const tRanges = useTranslations("metrics.filters.ranges");
  const [color, setColor] = useState<ProjectColor>(isProjectColor(project.color) ? project.color : "blue");
  const [metricsRange, setMetricsRange] = useState(project.metrics.range);
  const [metricsLead, setMetricsLead] = useState(project.metrics.lead);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const check = updateProjectSchema.safeParse({ name: formData.get("name"), color, metricsRange, metricsLead });
    if (!check.success) {
      const fieldErrors = toFieldErrors(check.error);
      setErrors(fieldErrors);
      focusFirstInvalid(form, fieldErrors);
      return;
    }

    startTransition(async () => {
      const result = await updateProjectAction(project.id, formData);
      if (result?.fieldErrors || result?.error) {
        setErrors(result.fieldErrors ?? { form: result.error ?? "generic" });
        return;
      }
      setErrors({});
      onClose();
    });
  }

  const errorText = (key: string | undefined) => (key ? t(`errors.${key as "generic"}`) : undefined);

  return (
    <Modal open={open} onClose={onClose} title={t("editDialog.title")}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <Field label={t("editDialog.name")} error={errorText(errors.name)} required>
          {(props) => (
            <input {...props} name="name" defaultValue={project.name} autoComplete="off" className={FIELD} />
          )}
        </Field>

        <FieldGroup label={t("editDialog.color")} error={errorText(errors.color)}>
          <input type="hidden" name="color" value={color} />
          <RadioGroup
            label={t("editDialog.color")}
            value={color}
            options={PROJECT_COLORS.map((value) => ({ value, label: t(`colors.${value}`) }))}
            onChange={setColor}
            className="grid grid-cols-4 gap-2"
            optionClassName={(checked) =>
              `flex items-center gap-2 rounded-tile px-2 py-2 text-xs transition-colors duration-150 ease-signature motion-reduce:transition-none ${
                checked ? "bg-tile text-ink" : "text-ink-muted hover:bg-raised"
              }`
            }
            renderOption={(option) => (
              <>
                <span
                  aria-hidden
                  className="size-3 flex-none rounded-full"
                  style={{ backgroundColor: `var(--color-project-${option.value})` }}
                />
                <span className="truncate">{option.label}</span>
              </>
            )}
          />
        </FieldGroup>

        <FieldGroup
          label={t("editDialog.metricsRange")}
          hint={t("editDialog.metricsRangeHint")}
          error={errorText(errors.metricsRange)}
        >
          <input type="hidden" name="metricsRange" value={metricsRange} />
          <RadioGroup
            label={t("editDialog.metricsRange")}
            value={metricsRange}
            options={METRIC_RANGES.map((value) => ({ value, label: tRanges(value) }))}
            onChange={setMetricsRange}
            className={PILLS}
            optionClassName={pill}
            renderOption={(option) => option.label}
          />
        </FieldGroup>

        <FieldGroup
          label={t("editDialog.metricsLead")}
          hint={t("editDialog.metricsLeadHint")}
          error={errorText(errors.metricsLead)}
        >
          <input type="hidden" name="metricsLead" value={metricsLead} />
          <RadioGroup
            label={t("editDialog.metricsLead")}
            value={metricsLead}
            options={METRIC_LEADS.map((value) => ({ value, label: t(`editDialog.leads.${value}`) }))}
            onChange={setMetricsLead}
            className={PILLS}
            optionClassName={pill}
            renderOption={(option) => option.label}
          />
        </FieldGroup>

        {errors.form && (
          <p role="alert" className="text-sm text-warn">
            {errorText(errors.form)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BUTTON_GHOST}>
            {t("editDialog.cancel")}
          </button>
          <button type="submit" aria-disabled={pending} className={BUTTON_PRIMARY}>
            {pending ? t("editDialog.saving") : t("editDialog.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
