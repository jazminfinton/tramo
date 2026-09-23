"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";

import { Field, FIELD } from "@/components/common/field";
import { createProjectAction } from "@/features/projects/actions";
import { BUTTON_PRIMARY } from "@/features/projects/components/styles";
import { createProjectSchema } from "@/features/projects/schema";
import { focusFirstInvalid, toFieldErrors, type FieldErrors } from "@/lib/form";

export function CreateProjectForm() {
  const t = useTranslations("projects");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const check = createProjectSchema.safeParse({ name: formData.get("name") });
    if (!check.success) {
      const fieldErrors = toFieldErrors(check.error);
      setErrors(fieldErrors);
      focusFirstInvalid(form, fieldErrors);
      return;
    }

    startTransition(async () => {
      const result = await createProjectAction(formData);
      if (result?.fieldErrors) {
        setErrors(result.fieldErrors);
        focusFirstInvalid(form, result.fieldErrors);
        return;
      }
      setErrors({});
      form.reset();
    });
  }

  return (
    <form noValidate onSubmit={submit} className="panel grain flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <Field
        label={t("create.name")}
        error={errors.name ? t(`errors.${errors.name as "nameRequired"}`) : undefined}
        className="flex-1"
      >
        {(props) => (
          <input {...props} name="name" autoComplete="off" placeholder={t("create.placeholder")} className={FIELD} />
        )}
      </Field>
      <button type="submit" aria-disabled={pending} className={`${BUTTON_PRIMARY} self-start py-2.5 sm:mt-6`}>
        <Plus className="icon size-4" aria-hidden />
        {pending ? t("create.submitting") : t("create.submit")}
      </button>
    </form>
  );
}
