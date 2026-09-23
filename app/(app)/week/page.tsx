import { RefreshOnFocus } from "@/components/common/refresh-on-focus";
import { TeamWeekView } from "@/features/time/components/team-week-view";
import { WeekView } from "@/features/time/components/week-view";
import { getTeamWeekData, getWeekData } from "@/features/time/queries";
import { DEFAULT_TIME_ZONE } from "@/i18n/config";
import { getProjectAccess, requireMember } from "@/lib/dal";

export default async function WeekPage({ searchParams }: PageProps<"/week">) {
  const { user, workspace, isAdmin } = await requireMember();
  const { w, view } = await searchParams;
  const timeZone = user.timeZone ?? DEFAULT_TIME_ZONE;
  const { persona } = await getProjectAccess(user.id, workspace.id);

  // Only trackers have a week of their own, so only they pick whose to see.
  // Observers (and anyone without projects) see the team's.
  const tabs = persona === "tracker";
  const team = !tabs || view === "team";

  return (
    <>
      <RefreshOnFocus />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
        {team ? (
          <TeamWeekView
            data={await getTeamWeekData({ userId: user.id, workspaceId: workspace.id, isAdmin, weekParam: w, timeZone })}
            timeZone={timeZone}
            tabs={tabs}
          />
        ) : (
          <WeekView data={await getWeekData(user.id, workspace.id, w, timeZone)} timeZone={timeZone} tabs={tabs} />
        )}
      </main>
    </>
  );
}
