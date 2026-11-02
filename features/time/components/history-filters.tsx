"use client";

import { Search } from "lucide-react";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useOptimistic, useState, useTransition } from "react";

import { DateRangeField } from "@/components/common/date-range-field";
import { Dropdown } from "@/components/common/dropdown";
import { FIELD } from "@/components/common/field";
import { announceNavigation } from "@/components/global/navigation-progress";
import { hasFilters, historyQuery, NO_FILTERS, tidySearch, type HistoryFilters } from "@/features/time/history-filters";
import { DESCRIPTION_MAX } from "@/features/time/schema";
import { MAX_RANGE_DAYS } from "@/lib/date-range";

type HistoryFilterBarProps = {
  filters: HistoryFilters;
  people: { id: string; name: string }[];
  tasks: { id: string; name: string }[];
  /** Today on the viewer's calendar: the last day the calendar offers. */
  today: string;
  /** What the filters found, already written. */
  summary: string;
};

const ALL = "all";

// How long the typing has to stop before the search goes out: long enough for the
// database to see one query per search, not one per word.
const SEARCH_PAUSE = 1000;

/**
 * The history's filters. There's nothing to apply: each choice is a navigation to
 * a new URL, and the server filters and renders the list. They replace the URL
 * instead of adding to the history, so Back leaves the page instead of undoing
 * them one by one, and any change starts over from the first page.
 */
export function HistoryFilterBar({ filters, people, tasks, today, summary }: HistoryFilterBarProps) {
  const t = useTranslations("timer.history");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(filters);
  const [text, setText] = useState(filters.text);

  function apply(changes: Partial<HistoryFilters>) {
    // What's typed and still waiting goes along: one change, one query.
    const next = { ...shown, text: tidySearch(text), ...changes };
    announceNavigation();
    startTransition(() => {
      setShown(next);
      router.replace(`${pathname}?${historyQuery(next)}` as Route, { scroll: false });
    });
  }

  const search = useEffectEvent((value: string) => {
    if (tidySearch(value) !== shown.text) apply({ text: tidySearch(value) });
  });

  useEffect(() => {
    if (tidySearch(text) === filters.text) return;
    const timeout = setTimeout(() => search(text), SEARCH_PAUSE);
    return () => clearTimeout(timeout);
  }, [text, filters.text]);

  const range = shown.from && shown.to ? { from: shown.from, to: shown.to } : null;

  return (
    <div aria-busy={pending} data-tour="history-filters" className="panel grain flex flex-col gap-3 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Dropdown
          label={t("person")}
          value={shown.person ?? ALL}
          onChange={(value) => apply({ person: value === ALL ? null : value })}
          options={[
            { value: ALL, label: t("allPeople") },
            ...people.map((person) => ({ value: person.id, label: person.name })),
          ]}
        />
        <DateRangeField
          field
          label={t("dates")}
          placeholder={t("pickDates")}
          picked={range !== null}
          value={range}
          max={today}
          maxDays={MAX_RANGE_DAYS}
          onChange={(picked) => apply(picked)}
        />
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            // Enter doesn't wait for the pause.
            if (tidySearch(text) !== shown.text) apply({});
          }}
        >
          <label className="relative flex">
            <span className="sr-only">{t("text")}</span>
            <Search
              aria-hidden
              className="icon pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-dim"
            />
            <input
              type="text"
              enterKeyHint="search"
              value={text}
              maxLength={DESCRIPTION_MAX}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("text")}
              className={`${FIELD} pl-9`}
            />
          </label>
        </form>
        <Dropdown
          label={t("task")}
          value={shown.task ?? ALL}
          onChange={(value) => apply({ task: value === ALL ? null : value })}
          options={[
            { value: ALL, label: t("allTasks") },
            ...tasks.map((task) => ({ value: task.id, label: task.name })),
          ]}
        />
      </div>

      <div className="flex min-h-6 items-center justify-between gap-3">
        <p role="status" className="digits text-xs text-ink-muted">
          {summary}
        </p>
        {(hasFilters(shown) || tidySearch(text) !== "") && (
          <button
            type="button"
            onClick={() => {
              setText("");
              apply(NO_FILTERS);
            }}
            className="flex-none font-display text-xs text-ink-muted transition-colors duration-150 ease-signature hover:text-ink motion-reduce:transition-none"
          >
            {t("clear")}
          </button>
        )}
      </div>
    </div>
  );
}
