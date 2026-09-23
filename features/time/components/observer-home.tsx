import { Eye } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Avatar } from "@/components/common/avatar";
import type { TeamWeekData } from "@/features/time/queries";
import { formatHours } from "@/lib/duration";

type ObservedProject = { id: string; name: string; color: string };

/**
 * Home for someone who only observes: there's no timer for them, so it says
 * what they follow, where to see it in detail, and how to start logging time
 * if they ever need to.
 */
export async function ObserverHome({ projects }: { projects: ObservedProject[] }) {
  const t = await getTranslations("observer");

  return (
    <section data-tour="observer-home" className="panel-accent flex flex-col items-start gap-4 p-5">
      <span className="tile size-10" aria-hidden>
        <Eye className="icon size-5 text-accent" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-base font-medium">{t("title")}</h2>
        <p className="text-sm text-ink-muted">{t("body")}</p>
      </div>
      <ul aria-label={t("projects")} className="flex flex-wrap gap-1.5">
        {projects.map((project) => (
          <li key={project.id} className="inline-flex items-center gap-1.5 rounded-pill bg-tile px-2.5 py-1 text-xs">
            <span
              aria-hidden
              className="size-2 flex-none rounded-full"
              style={{ backgroundColor: `var(--color-project-${project.color})` }}
            />
            {project.name}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/week"
          className="rounded-tile bg-accent px-4 py-2.5 font-display text-sm font-medium text-on-accent transition-opacity duration-150 ease-signature hover:opacity-90 motion-reduce:transition-none"
        >
          {t("teamWeek")}
        </Link>
        <Link
          href="/metrics"
          className="rounded-tile bg-raised px-4 py-2.5 font-display text-sm transition-colors duration-150 ease-signature hover:bg-tile motion-reduce:transition-none"
        >
          {t("metrics")}
        </Link>
      </div>
      <p className="text-xs text-ink-dim">{t("needToTrack")}</p>
    </section>
  );
}

/** This week in the observed projects, per person: the first thing an observer wants to know. */
export async function TeamWeekSummary({ data }: { data: TeamWeekData }) {
  const t = await getTranslations("observer");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-display text-xs tracking-widest text-ink-dim uppercase">{t("thisWeek")}</h2>
        <span className="digits text-sm text-ink-muted">{formatHours(data.buckets.total)}</span>
      </div>
      {data.people.length === 0 ? (
        <p className="panel grain p-5 text-sm text-ink-muted">{t("quietWeek")}</p>
      ) : (
        <ul className="panel grain flex flex-col">
          {data.people.map((person) => (
            <li key={person.id} className="flex items-center gap-3 px-4 py-3 not-first:hairline-t">
              <Avatar name={person.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm">{person.name}</span>
              <span className="digits text-sm">
                {formatHours((data.buckets.byKey.get(person.id) ?? []).reduce((sum, value) => sum + value, 0))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
