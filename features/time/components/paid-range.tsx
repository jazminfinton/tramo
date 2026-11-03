"use client";

import { CircleDollarSign } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { DateRangeField } from "@/components/common/date-range-field";
import { Dropdown } from "@/components/common/dropdown";
import { FIELD_LABEL } from "@/components/common/field";
import { Modal } from "@/components/common/modal";
import type { PaidDay, PaidRangePreview } from "@/features/time/paid";
import {
  paidDaysAction,
  payablePeopleAction,
  previewPaidRangeAction,
  setPaidRangeAction,
} from "@/features/time/paid-actions";
import { MAX_RANGE_DAYS, type DayRange } from "@/lib/date-range";
import { addMonths } from "@/lib/dates";
import { formatHours } from "@/lib/duration";

type PaidRangeProject = { id: string; name: string; color: string; archived: boolean };

type PaidRangeProps = {
  /** The projects whose hours the viewer can mark. */
  projects: PaidRangeProject[];
  /** The project in the filters, already chosen when the dialog opens; null asks for one. */
  initialProject: string | null;
  /** Today on the viewer's calendar: the last day on offer. */
  today: string;
  /** An admin chooses whose hours; anyone else marks their own. Only for the form: the server decides. */
  team: boolean;
};

// A field's value before anything is chosen, and the choice of all of them:
// "every project" and "the whole team" have to be picked on purpose.
const UNCHOSEN = "";
const ALL = "all";

const BUTTON = "rounded-tile px-4 py-2.5 font-display text-sm aria-disabled:cursor-wait aria-disabled:opacity-60";
const FADE = "transition-opacity duration-150 ease-signature hover:opacity-90 motion-reduce:transition-none";
const SHADE = "transition-colors duration-150 ease-signature motion-reduce:transition-none";

/**
 * Pay mode: marks a range of days as paid in one go. It asks in order, because
 * what gets marked depends on it: which project, whose hours and, only then,
 * which days. The calendar shows how much of each day is already paid for that
 * choice, and picking the range says what the mark would touch, right there.
 */
export function PaidRange({ projects, initialProject, today, team }: PaidRangeProps) {
  const t = useTranslations("paid.range");
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState("");

  return (
    <>
      <button
        type="button"
        data-tour="metrics-paid"
        onClick={() => {
          setDone("");
          setOpen(true);
        }}
        className="inline-flex h-10 items-center gap-2 rounded-tile bg-surface px-3 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:text-ink motion-reduce:transition-none"
      >
        <CircleDollarSign className="icon size-4 flex-none" aria-hidden />
        {t("open")}
      </button>
      <span role="status" className="text-xs text-ink-muted">
        {done}
      </span>

      <Modal open={open} onClose={() => setOpen(false)} title={t("title")}>
        {/* Mounted per opening: each one starts from the choosing, and asks for fresh marks. */}
        {open && (
          <PaidRangeForm
            projects={projects}
            initialProject={initialProject}
            today={today}
            team={team}
            onClose={() => setOpen(false)}
            onDone={(message) => {
              setDone(message);
              setOpen(false);
            }}
          />
        )}
      </Modal>
    </>
  );
}

type Scope = { projectId: string | null; personId: string | null };

const scopeOf = (project: string, person: string): Scope => ({
  projectId: project === ALL ? null : project,
  personId: person === ALL ? null : person,
});

function PaidRangeForm({
  projects,
  initialProject,
  today,
  team,
  onClose,
  onDone,
}: PaidRangeProps & { onClose: () => void; onDone: (message: string) => void }) {
  const t = useTranslations("paid.range");
  const tErrors = useTranslations("paid.errors");
  const [project, setProject] = useState(initialProject ?? UNCHOSEN);
  // Nobody but an admin chooses here: the server gives them their own hours.
  const [person, setPerson] = useState(team ? UNCHOSEN : ALL);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [range, setRange] = useState<DayRange | null>(null);
  const [preview, setPreview] = useState<PaidRangePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, PaidDay>>({});
  const [pending, startTransition] = useTransition();
  // The answer that still matters: picking again leaves older ones behind.
  const asked = useRef(0);
  // The years whose marks were asked for, for the current choice. Choosing again
  // replaces the set, which also leaves behind the answers still on their way.
  const loaded = useRef(new Set<number>());
  const ready = project !== UNCHOSEN && person !== UNCHOSEN;

  useEffect(() => {
    if (!team) return;
    let current = true;
    payablePeopleAction().then(
      (result) => {
        if (!current) return;
        if ("error" in result) setError(result.error);
        else setPeople(result.people);
      },
      () => {
        if (current) setError("generic");
      },
    );
    return () => {
      current = false;
    };
  }, [team]);

  function ask(picked: DayRange, { projectId, personId }: Scope) {
    const question = ++asked.current;
    setRange(picked);
    setPreview(null);
    setError(null);
    startTransition(async () => {
      const result = await previewPaidRangeAction(picked.from, picked.to, projectId, personId);
      if (question !== asked.current) return;
      if ("error" in result) setError(result.error);
      else setPreview(result.preview);
    });
  }

  function choose(nextProject: string, nextPerson: string) {
    setProject(nextProject);
    setPerson(nextPerson);
    // The marks and the summary were about the hours chosen before.
    loaded.current = new Set();
    setMarks({});
    if (range) ask(range, scopeOf(nextProject, nextPerson));
  }

  // A year at a time, once per choice: turning the months asks for nothing new.
  function loadMarks(first: Date, count: number) {
    const { projectId, personId } = scopeOf(project, person);
    const batch = loaded.current;
    const years = new Set([first.getFullYear(), addMonths(first, count - 1).getFullYear()]);

    for (const year of years) {
      if (batch.has(year)) continue;
      batch.add(year);
      // Without marks the calendar still works, and the next opening asks again.
      const forget = () => {
        batch.delete(year);
      };
      paidDaysAction(`${year}-01-01`, `${year}-12-31`, projectId, personId).then((result) => {
        if ("error" in result) return forget();
        if (batch !== loaded.current) return;
        setMarks((current) => ({ ...current, ...Object.fromEntries(result.days.map((row) => [row.day, row])) }));
      }, forget);
    }
  }

  function mark(paid: boolean) {
    if (!range || pending) return;
    const { projectId, personId } = scopeOf(project, person);
    setError(null);
    startTransition(async () => {
      const result = await setPaidRangeAction(range.from, range.to, projectId, personId, paid);
      if ("error" in result) setError(result.error);
      else onDone(t(paid ? "marked" : "unmarked", { count: result.count }));
    });
  }

  const nothing = preview !== null && preview.unpaidCount === 0 && preview.paidCount === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>{t("project")}</span>
        <Dropdown
          label={t("project")}
          placeholder={t("projectPlaceholder")}
          value={project}
          onChange={(value) => choose(value, person)}
          options={[
            { value: ALL, label: t("allProjects") },
            ...projects.map((item) => ({
              value: item.id,
              label: item.archived ? t("archived", { name: item.name }) : item.name,
              icon: (
                <span
                  aria-hidden
                  className="size-2.5 flex-none rounded-full"
                  style={{ backgroundColor: `var(--color-project-${item.color})` }}
                />
              ),
            })),
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>{t("person")}</span>
        {team ? (
          <Dropdown
            label={t("person")}
            placeholder={t("personPlaceholder")}
            value={person}
            onChange={(value) => choose(project, value)}
            options={[
              { value: ALL, label: t("team") },
              ...people.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
        ) : (
          <p className="rounded-tile bg-raised py-2.5 pl-3 text-sm text-ink-muted">{t("mine")}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>{t("dates")}</span>
        <DateRangeField
          field
          disabled={!ready}
          label={t("dates")}
          placeholder={ready ? t("pickDates") : t(team ? "pickScopeFirst" : "pickProjectFirst")}
          picked={range !== null}
          value={range}
          max={today}
          maxDays={MAX_RANGE_DAYS}
          onChange={(picked) => ask(picked, scopeOf(project, person))}
          hints={{ start: t("pickStart"), end: t("pickEnd") }}
          onViewChange={loadMarks}
          renderDayMark={(day, onAccent) => {
            const count = marks[day];
            return count && <DayMark paid={count.paid} total={count.paid + count.unpaid} onAccent={onAccent} />;
          }}
          describeDay={(day) => {
            const count = marks[day];
            return count && t("day", { paid: count.paid, total: count.paid + count.unpaid });
          }}
          legend={
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-1 w-4 rounded-full bg-accent" />
                {t("legendPaid")}
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-1 w-4 rounded-full bg-ink/20" />
                {t("legendUnpaid")}
              </li>
            </ul>
          }
        />
      </div>

      {/* Always there, so a screen reader hears what comes into it. */}
      <div aria-live="polite" className="digits flex flex-col gap-1 text-sm empty:hidden">
        {range && !preview && !error && <p className="text-ink-dim">{t("loading")}</p>}
        {nothing && <p className="text-ink-muted">{t("empty")}</p>}
        {preview && !nothing && (
          <>
            <p>
              {preview.unpaidCount > 0
                ? t("unpaid", { count: preview.unpaidCount, hours: formatHours(preview.unpaidMinutes) })
                : t("nothingUnpaid")}
            </p>
            {preview.paidCount > 0 && <p className="text-ink-muted">{t("paid", { count: preview.paidCount })}</p>}
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-tile bg-warn/10 px-4 py-3 text-sm text-warn">
          {tErrors(error as "generic")}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className={`${BUTTON} ${SHADE} text-ink-muted hover:bg-raised hover:text-ink`}
        >
          {t("cancel")}
        </button>
        {preview && preview.paidCount > 0 && (
          <button
            type="button"
            aria-disabled={pending}
            onClick={() => mark(false)}
            className={`${BUTTON} ${SHADE} bg-raised hover:bg-tile`}
          >
            {t("unmark")}
          </button>
        )}
        {preview && preview.unpaidCount > 0 && (
          <button
            type="button"
            aria-disabled={pending}
            onClick={() => mark(true)}
            className={`${BUTTON} ${FADE} bg-accent font-medium text-on-accent`}
          >
            {t("mark")}
          </button>
        )}
      </div>
    </div>
  );
}

/** How much of a day is paid, read by length: the colored part is paid, the faint one is what's left. */
function DayMark({ paid, total, onAccent }: { paid: number; total: number; onAccent: boolean }) {
  return (
    <span className={`flex h-1 w-5 overflow-hidden rounded-full ${onAccent ? "bg-on-accent/30" : "bg-ink/20"}`}>
      <span
        className={`h-full rounded-full ${onAccent ? "bg-on-accent" : "bg-accent"}`}
        style={{ width: `${(paid / total) * 100}%` }}
      />
    </span>
  );
}
