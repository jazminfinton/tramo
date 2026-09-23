"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";

import { Field, FIELD } from "@/components/common/field";
import { renameWorkspaceAction } from "@/features/workspace/actions";
import { workspaceNameSchema } from "@/features/workspace/schema";
import { focusFirstInvalid, toFieldErrors, type FieldErrors } from "@/lib/form";

export function WorkspaceForm({ name }: { name: string }) {
  const t = useTranslations("workspace");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSaved(false);

    const check = workspaceNameSchema.safeParse({ name: formData.get("name") });
    if (!check.success) {
      const fieldErrors = toFieldErrors(check.error);
      setErrors(fieldErrors);
      focusFirstInvalid(form, fieldErrors);
      return;
    }

    startTransition(async () => {
      const result = await renameWorkspaceAction(formData);
      if (result?.fieldErrors || result?.error) {
        setErrors(result.fieldErrors ?? { name: result.error ?? "generic" });
        return;
      }
      setErrors({});
      setSaved(true);
    });
  }

  return (
    <form noValidate onSubmit={submit} className="panel grain flex flex-col gap-4 p-5">
      <Field
        label={t("name")}
        hint={t("hint")}
        error={errors.name ? t(`errors.${errors.name as "generic"}`) : undefined}
        required
      >
        {(props) => (
          <input {...props} name="name" defaultValue={name} autoComplete="off" maxLength={60} className={FIELD} />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          aria-disabled={pending}
          className="rounded-tile bg-accent px-4 py-2.5 font-display text-sm font-medium text-on-accent transition-opacity duration-150 ease-signature hover:opacity-90 aria-disabled:cursor-wait aria-disabled:opacity-60 motion-reduce:transition-none"
        >
          {pending ? t("saving") : t("save")}
        </button>
        {saved && (
          <p role="status" className="text-sm text-ink-muted">
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
