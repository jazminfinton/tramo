import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { shiftIsoDate, zonedInstant } from "@/lib/zoned";

const NAV_BUTTON =
  "flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none";

export type WeekViewKind = "mine" | "team";

type WeekHeaderProps = {
  week: string;
  currentWeek: string;
  /** The week's seven days (ISO dates), Monday first. */
  days: string[];
  timeZone: string;
  /** Which week is on screen: the arrows stay in it. */
  view: WeekViewKind;
  /** The "Mías / Equipo" switch, for people who have a week of their own. */
  tabs: boolean;
};

/** The week's title, the arrows to move between weeks and, when it applies, whose week to see. */
export async function WeekHeader({ week, currentWeek, days, timeZone, view, tabs }: WeekHeaderProps) {
  const [t, format] = await Promise.all([getTranslations("week"), getFormatter()]);

  // Noon of each calendar day in the person's zone: a safe instant to format.
  const dayInstant = (isoDate: string) => zonedInstant(isoDate, 12 * 60, timeZone);
  const title = format.dateTimeRange(dayInstant(days[0] ?? week), dayInstant(days[6] ?? week), {
    day: "numeric",
    month: "long",
  });
  const isCurrent = week === currentWeek;

  // The URL of a week in a view; the current week needs no parameter.
  const href = (target: { week: string; view: WeekViewKind }) => ({
    pathname: "/week" as const,
    query: {
      ...(target.view === "team" ? { view: "team" } : {}),
      ...(target.week === currentWeek ? {} : { w: target.week }),
    },
  });

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-display text-xs tracking-widest text-ink-dim uppercase">
            {isCurrent ? t("thisWeek") : t("week")}
          </p>
          <h1 className="poster text-5xl uppercase sm:text-7xl">{title}</h1>
        </div>
        <nav aria-label={t("navigation")} className="ml-auto flex items-center gap-1">
          <Link href={href({ week: shiftIsoDate(week, -7), view })} aria-label={t("previous")} className={NAV_BUTTON}>
            <ChevronLeft className="icon size-5" aria-hidden />
          </Link>
          {!isCurrent && (
            <Link
              href={href({ week: currentWeek, view })}
              className="rounded-pill px-3 py-1.5 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none"
            >
              {t("backToThisWeek")}
            </Link>
          )}
          <Link href={href({ week: shiftIsoDate(week, 7), view })} aria-label={t("next")} className={NAV_BUTTON}>
            <ChevronRight className="icon size-5" aria-hidden />
          </Link>
        </nav>
      </div>

      {tabs && (
        <nav aria-label={t("whose")} data-tour="week-tabs" className="flex w-fit gap-1 rounded-tile bg-surface p-1">
          {(["mine", "team"] as const).map((option) => (
            <Link
              key={option}
              href={href({ week, view: option })}
              aria-current={view === option ? "page" : undefined}
              className="rounded-[6px] px-3 py-1.5 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:text-ink aria-[current=page]:bg-tile aria-[current=page]:text-ink motion-reduce:transition-none"
            >
              {t(option)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
