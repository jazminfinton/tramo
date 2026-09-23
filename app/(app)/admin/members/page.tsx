import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";

import { AdminNav } from "@/components/global/admin-nav";
import { InviteForm } from "@/features/members/components/invite-form";
import {
  ActiveMemberActions,
  PendingActions,
  RestoreAction,
  RevokeInvitation,
} from "@/features/members/components/member-actions";
import { listInvitableProjects, listMembers, listOpenInvitations } from "@/features/members/queries";
import { requireAdmin } from "@/lib/dal";

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xs tracking-widest text-ink-dim uppercase">
        {title} <span className="digits">({count})</span>
      </h2>
      <ul className="panel grain flex flex-col">{children}</ul>
    </section>
  );
}

type RowProps = { primary: ReactNode; secondary: ReactNode; actions: ReactNode; details?: ReactNode };

function Row({ primary, secondary, actions, details }: RowProps) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 not-first:hairline-t sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{primary}</span>
        <span className="truncate text-xs text-ink-dim">{secondary}</span>
        {details}
      </div>
      {actions}
    </li>
  );
}

export default async function MembersPage() {
  const { user, workspace } = await requireAdmin();
  const [t, tProjectRoles, format, members, invitations, projects] = await Promise.all([
    getTranslations("members"),
    getTranslations("projects.roles"),
    getFormatter(),
    listMembers(workspace.id),
    listOpenInvitations(workspace.id),
    listInvitableProjects(workspace.id),
  ]);

  const pending = members.filter((member) => member.status === "PENDING");
  const active = members.filter((member) => member.status === "ACTIVE");
  const rejected = members.filter((member) => member.status === "REJECTED");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <AdminNav current="members" />
      <header className="flex flex-col gap-1">
        <h1 className="poster text-6xl uppercase sm:text-7xl">{t("title")}</h1>
        <p className="text-sm text-ink-muted">{t("subtitle")}</p>
      </header>

      <InviteForm projects={projects} />

      {pending.length > 0 && (
        <Section title={t("pending.title")} count={pending.length}>
          {pending.map((member) => (
            <Row
              key={member.id}
              primary={member.user.name}
              secondary={`${member.user.email} · ${t("pending.requested", {
                date: format.relativeTime(member.createdAt),
              })}`}
              actions={<PendingActions memberId={member.id} />}
            />
          ))}
        </Section>
      )}

      <Section title={t("active.title")} count={active.length}>
        {active.map((member) => (
          <Row
            key={member.id}
            primary={member.user.id === user.id ? `${member.user.name} · ${t("active.you")}` : member.user.name}
            secondary={member.user.email}
            actions={
              member.user.id === user.id ? (
                <span className="rounded-pill bg-tile px-3 py-1 font-display text-xs">{t(`roles.${member.role}`)}</span>
              ) : (
                <ActiveMemberActions memberId={member.id} name={member.user.name} role={member.role} />
              )
            }
          />
        ))}
      </Section>

      {invitations.length > 0 && (
        <Section title={t("invitations.title")} count={invitations.length}>
          {invitations.map((invitation) => (
            <Row
              key={invitation.id}
              primary={invitation.email}
              secondary={t("invitations.invitedAs", { role: t(`roles.${invitation.role}`) })}
              details={
                invitation.projects.length > 0 && (
                  <ul aria-label={t("invitations.projects")} className="mt-2 flex flex-wrap gap-1.5">
                    {invitation.projects.map(({ project, role }) => (
                      <li key={project.id} className="inline-flex items-center gap-1.5 rounded-pill bg-tile px-2.5 py-1 text-xs">
                        <span
                          aria-hidden
                          className="size-2 flex-none rounded-full"
                          style={{ backgroundColor: `var(--color-project-${project.color})` }}
                        />
                        {t("invitations.projectAs", { project: project.name, role: tProjectRoles(role) })}
                      </li>
                    ))}
                  </ul>
                )
              }
              actions={<RevokeInvitation invitationId={invitation.id} email={invitation.email} />}
            />
          ))}
        </Section>
      )}

      {rejected.length > 0 && (
        <Section title={t("rejected.title")} count={rejected.length}>
          {rejected.map((member) => (
            <Row
              key={member.id}
              primary={member.user.name}
              secondary={member.user.email}
              actions={<RestoreAction memberId={member.id} />}
            />
          ))}
        </Section>
      )}
    </main>
  );
}
