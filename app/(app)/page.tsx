import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { RefreshOnFocus } from "@/components/common/refresh-on-focus";
import { ObserverHome, TeamWeekSummary } from "@/features/time/components/observer-home";
import { RecentEntries } from "@/features/time/components/recent-entries";
import { TimerBar } from "@/features/time/components/timer-bar";
import { getTeamWeekData, getTimerPageData } from "@/features/time/queries";
import { DEFAULT_TIME_ZONE } from "@/i18n/config";
import { getProjectAccess, requireMember } from "@/lib/dal";

/**
 * Home: the timer and the latest blocks. Someone who only observes gets what
 * they follow and this week's hours per person instead, since they never log
 * time; someone with no project yet gets told what to do next.
 */
export default async function HomePage() {
  const { user, workspace, isAdmin } = await requireMember();
  const timeZone = user.timeZone ?? DEFAULT_TIME_ZONE;
  const [t, data, access] = await Promise.all([
    getTranslations("timer"),
    getTimerPageData(user.id, workspace.id),
    getProjectAccess(user.id, workspace.id),
  ]);

  const canTrack = data.projects.length > 0 || data.timer !== null;
  const observing = !canTrack && access.persona === "observer";
  const teamWeek = observing
    ? await getTeamWeekData({ userId: user.id, workspaceId: workspace.id, isAdmin, weekParam: undefined, timeZone })
    : null;

  return (
    <>
      <RefreshOnFocus />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
        <h1 className="sr-only">{t("title")}</h1>

        {canTrack ? (
          <TimerBar
            projects={data.projects}
            timer={data.timer}
            suggestions={data.suggestions}
            serverNow={data.serverNow}
          />
        ) : observing ? (
          <ObserverHome projects={access.observed} />
        ) : (
          <section className="panel-accent flex flex-col items-start gap-3 p-5">
            <span className="tile size-10" aria-hidden>
              <FolderKanban className="icon size-5 text-accent" />
            </span>
            <h2 className="font-display text-base font-medium">{t("noProjects.title")}</h2>
            <p className="text-sm text-ink-muted">{isAdmin ? t("noProjects.admin") : t("noProjects.member")}</p>
            {isAdmin && (
              <Link
                href="/admin/projects"
                className="rounded-tile bg-accent px-4 py-2.5 font-display text-sm font-medium text-on-accent transition-opacity duration-150 ease-signature hover:opacity-90 motion-reduce:transition-none"
              >
                {t("noProjects.adminCta")}
              </Link>
            )}
          </section>
        )}

        {teamWeek && <TeamWeekSummary data={teamWeek} />}

        {/* A history of one's own blocks: only for people who log time, or did. */}
        {(canTrack || data.recent.length > 0) && (
          <RecentEntries
            entries={data.recent}
            projects={data.projects}
            suggestions={data.suggestions}
            timeZone={timeZone}
          />
        )}
      </main>
    </>
  );
}
