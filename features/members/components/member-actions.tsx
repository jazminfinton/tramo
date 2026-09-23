"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";

import { ConfirmButton } from "@/components/common/confirm-dialog";
import { RadioGroup } from "@/components/common/radio-group";
import {
  approveMemberAction,
  rejectMemberAction,
  revokeInvitationAction,
  setMemberRoleAction,
} from "@/features/members/actions";
import { WORKSPACE_ROLES } from "@/features/members/schema";
import type { ActionResult } from "@/lib/form";

type Role = (typeof WORKSPACE_ROLES)[number];

const PRIMARY =
  "rounded-tile bg-accent px-3 py-1.5 font-display text-sm font-medium text-on-accent transition-opacity duration-150 ease-signature hover:opacity-90 aria-disabled:cursor-wait aria-disabled:opacity-60 motion-reduce:transition-none";
const GHOST =
  "rounded-tile px-3 py-1.5 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink aria-disabled:cursor-wait aria-disabled:opacity-60 motion-reduce:transition-none";

/**
 * Runs an action, keeping its error key for display. `optimistic` runs first,
 * inside the same transition, to show the outcome before the server answers.
 */
function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, optimistic?: () => void) {
    setError(null);
    startTransition(async () => {
      optimistic?.();
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return { error, pending, run };
}

function ErrorLine({ error }: { error: string | null }) {
  const t = useTranslations("members.errors");
  if (!error) return null;
  return (
    <p role="alert" className="w-full text-xs text-warn">
      {t(error as "generic")}
    </p>
  );
}

export function PendingActions({ memberId }: { memberId: string }) {
  const t = useTranslations("members.pending");
  const { error, pending, run } = useAction();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" aria-disabled={pending} className={PRIMARY} onClick={() => run(() => approveMemberAction(memberId))}>
        {t("approve")}
      </button>
      <button type="button" aria-disabled={pending} className={GHOST} onClick={() => run(() => rejectMemberAction(memberId))}>
        {t("reject")}
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

export function RestoreAction({ memberId }: { memberId: string }) {
  const t = useTranslations("members.rejected");
  const { error, pending, run } = useAction();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" aria-disabled={pending} className={GHOST} onClick={() => run(() => approveMemberAction(memberId))}>
        {t("restore")}
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

export function ActiveMemberActions({
  memberId,
  name,
  role,
}: {
  memberId: string;
  name: string;
  role: Role;
}) {
  const t = useTranslations("members");
  const { error, run } = useAction();
  // The new role shows at once; a refusal (last admin) puts the old one back.
  const [shownRole, setShownRole] = useOptimistic(role);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <RadioGroup
        label={t("active.roleLabel", { name })}
        value={shownRole}
        options={WORKSPACE_ROLES.map((value) => ({ value, label: t(`roles.${value}`) }))}
        onChange={(next) =>
          run(
            () => setMemberRoleAction(memberId, next),
            () => setShownRole(next),
          )
        }
        className="inline-flex gap-1 rounded-tile bg-raised p-1"
        optionClassName={(checked) =>
          `rounded-[6px] px-2.5 py-1 text-xs transition-colors duration-150 ease-signature motion-reduce:transition-none ${
            checked ? "bg-tile text-ink" : "text-ink-muted hover:text-ink"
          }`
        }
        renderOption={(option) => option.label}
      />
      <ConfirmButton
        className={GHOST}
        dialogTitle={t("active.removeTitle", { name })}
        description={t("active.removeBody")}
        confirmLabel={t("active.removeConfirm")}
        tone="danger"
        onConfirm={() => rejectMemberAction(memberId)}
        translateError={(key) => t(`errors.${key as "generic"}`)}
      >
        {t("active.removeAccess")}
      </ConfirmButton>
      <ErrorLine error={error} />
    </div>
  );
}

export function RevokeInvitation({ invitationId, email }: { invitationId: string; email: string }) {
  const t = useTranslations("members");

  return (
    <ConfirmButton
      className={GHOST}
      dialogTitle={t("invitations.revokeTitle", { email })}
      description={t("invitations.revokeBody")}
      confirmLabel={t("invitations.revokeConfirm")}
      tone="danger"
      onConfirm={() => revokeInvitationAction(invitationId)}
      translateError={(key) => t(`errors.${key as "generic"}`)}
    >
      {t("invitations.revoke")}
    </ConfirmButton>
  );
}
