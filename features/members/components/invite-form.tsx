"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";

import { Field, FIELD, FieldGroup } from "@/components/common/field";
import { RadioGroup } from "@/components/common/radio-group";
import { inviteMemberAction } from "@/features/members/actions";
import { INVITED_PROJECT_ROLES, inviteSchema, WORKSPACE_ROLES, type InvitedProject } from "@/features/members/schema";
import { focusFirstInvalid, toFieldErrors, type FieldErrors } from "@/lib/form";

type Role = (typeof WORKSPACE_ROLES)[number];
type ProjectRole = InvitedProject["role"];

export type InvitableProject = { id: string; name: string; color: string };

const segment = (checked: boolean) =>
  `rounded-[6px] px-3 py-1.5 text-sm transition-colors duration-150 ease-signature motion-reduce:transition-none ${
    checked ? "bg-tile text-ink" : "text-ink-muted hover:text-ink"
  }`;

/**
 * Pre-approves a Google email and, optionally, the projects the person joins
 * with their role on each. Submits by hand (onSubmit + transition) instead of
 * `<form action>`, so a rejected submission keeps what was typed.
 */
export function InviteForm({ projects }: { projects: InvitableProject[] }) {
  const t = useTranslations("members");
  const tProjectRoles = useTranslations("projects.roles");
  const [role, setRole] = useState<Role>("MEMBER");
  // Projects picked for this person, by id. Missing means "not in it".
  const [picks, setPicks] = useState<Record<string, ProjectRole>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [invited, setInvited] = useState<{ email: string; projects: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const picked: InvitedProject[] = Object.entries(picks).map(([projectId, projectRole]) => ({
    projectId,
    role: projectRole,
  }));

  function pick(projectId: string, value: ProjectRole | "NONE") {
    setPicks((current) => {
      const next = { ...current };
      if (value === "NONE") delete next[projectId];
      else next[projectId] = value;
      return next;
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setInvited(null);

    // Same schema as the action: instant feedback next to the field.
    const check = inviteSchema.safeParse({ email: formData.get("email"), role, projects: picked });
    if (!check.success) {
      const fieldErrors = toFieldErrors(check.error);
      setErrors(fieldErrors);
      focusFirstInvalid(form, fieldErrors);
      return;
    }

    startTransition(async () => {
      const result = await inviteMemberAction(formData);
      if (result?.fieldErrors) {
        setErrors(result.fieldErrors);
        focusFirstInvalid(form, result.fieldErrors);
        return;
      }
      setErrors({});
      setInvited({ email: check.data.email, projects: check.data.projects.length });
      setRole("MEMBER");
      setPicks({});
      form.reset();
    });
  }

  const errorText = (key: string | undefined) =>
    key ? t(`errors.${key as "invalidEmail"}`) : undefined;

  const projectOptions = [
    { value: "NONE" as const, label: t("invite.notInProject") },
    ...INVITED_PROJECT_ROLES.map((value) => ({ value, label: tProjectRoles(value) })),
  ];

  return (
    <form noValidate onSubmit={submit} data-tour="invite-form" className="panel grain flex flex-col gap-5 p-5">
      <h2 className="font-display text-base font-medium">{t("invite.title")}</h2>

      <Field label={t("invite.email")} error={errorText(errors.email)} required hint={t("invite.hint")}>
        {(props) => (
          <input
            {...props}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("invite.emailPlaceholder")}
            className={FIELD}
          />
        )}
      </Field>

      <FieldGroup label={t("invite.role")} error={errorText(errors.role)}>
        <input type="hidden" name="role" value={role} />
        <RadioGroup
          label={t("invite.role")}
          value={role}
          options={WORKSPACE_ROLES.map((value) => ({ value, label: t(`roles.${value}`) }))}
          onChange={setRole}
          className="inline-flex gap-1 rounded-tile bg-raised p-1"
          optionClassName={segment}
          renderOption={(option) => option.label}
        />
      </FieldGroup>

      {projects.length > 0 && (
        <FieldGroup label={t("invite.projects")} hint={t("invite.projectsHint")} error={errorText(errors.projects)}>
          {picked.map((project) => (
            <input key={project.projectId} type="hidden" name="projects" value={`${project.projectId}:${project.role}`} />
          ))}
          <ul className="flex flex-col rounded-tile bg-raised">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 pr-2 pl-3 not-first:hairline-t"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="size-2.5 flex-none rounded-full"
                    style={{ backgroundColor: `var(--color-project-${project.color})` }}
                  />
                  <span className="truncate">{project.name}</span>
                </span>
                <RadioGroup
                  label={t("invite.projectRole", { project: project.name })}
                  value={picks[project.id] ?? "NONE"}
                  options={projectOptions}
                  onChange={(value) => pick(project.id, value)}
                  className="inline-flex gap-1"
                  optionClassName={segment}
                  renderOption={(option) => option.label}
                />
              </li>
            ))}
          </ul>
        </FieldGroup>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          aria-disabled={pending}
          className="rounded-tile bg-accent px-4 py-2.5 font-display text-sm font-medium text-on-accent transition-opacity duration-150 ease-signature hover:opacity-90 aria-disabled:cursor-wait aria-disabled:opacity-60 motion-reduce:transition-none"
        >
          {pending ? t("invite.submitting") : t("invite.submit")}
        </button>
        {invited && (
          <p role="status" className="text-sm text-ink-muted">
            {t("invite.success", { email: invited.email, projects: invited.projects })}
          </p>
        )}
      </div>
    </form>
  );
}
