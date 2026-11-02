"use client";

import { CircleDollarSign } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { DateRangeField } from "@/components/common/date-range-field";
import { Modal } from "@/components/common/modal";
import type { PaidRangePreview } from "@/features/time/paid";
import { previewPaidRangeAction, setPaidRangeAction } from "@/features/time/paid-actions";
import { formatDayRange, MAX_RANGE_DAYS, type DayRange } from "@/lib/date-range";
import { formatHours } from "@/lib/duration";

type PaidRangeProps = {
  /** The days on show: where the calendar opens. */
  period: DayRange;
  /** Today on the viewer's calendar: the last day on offer. */
  today: string;
  /** The project in the filters, whose hours are the only ones touched; null is every project. */
  projectId: string | null;
  projectName: string | null;
  /** An admin marks the whole team's hours; anyone else, their own. Only for the words: the server decides. */
  team: boolean;
};

const BUTTON = "rounded-tile px-4 py-2.5 font-display text-sm aria-disabled:cursor-wait aria-disabled:opacity-60";
const FADE = "transition-opacity duration-150 ease-signature hover:opacity-90 motion-reduce:transition-none";
const SHADE = "transition-colors duration-150 ease-signature motion-reduce:transition-none";

/**
 * Pay mode: the calendar again, but the range it picks gets marked as paid in
 * one go instead of filtering the charts. Picking the second day opens a
 * confirmation that says what the mark would touch, and a range with blocks
 * already paid also offers taking the mark off, to undo a mistake.
 */
export function PaidRange({ period, today, projectId, projectName, team }: PaidRangeProps) {
  const t = useTranslations("paid.range");
  const tErrors = useTranslations("paid.errors");
  const [range, setRange] = useState<DayRange | null>(null);
  const [preview, setPreview] = useState<PaidRangePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState("");
  const [pending, startTransition] = useTransition();
  // The answer that still matters: closing or picking again leaves older ones behind.
  const asked = useRef(0);

  function ask(picked: DayRange) {
    const question = ++asked.current;
    setRange(picked);
    setPreview(null);
    setError(null);
    setDone("");
    startTransition(async () => {
      const result = await previewPaidRangeAction(picked.from, picked.to, projectId);
      if (question !== asked.current) return;
      if ("error" in result) setError(result.error);
      else setPreview(result.preview);
    });
  }

  function close() {
    asked.current += 1;
    setRange(null);
  }

  function mark(paid: boolean) {
    if (!range || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await setPaidRangeAction(range.from, range.to, projectId, paid);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(t(paid ? "marked" : "unmarked", { count: result.count }));
      close();
    });
  }

  const nothing = preview !== null && preview.unpaidCount === 0 && preview.paidCount === 0;

  return (
    <>
      <DateRangeField
        data-tour="metrics-paid"
        label={t("label")}
        placeholder={t("open")}
        picked={false}
        value={period}
        max={today}
        maxDays={MAX_RANGE_DAYS}
        onChange={ask}
        icon={<CircleDollarSign className="icon size-4 flex-none" aria-hidden />}
        hints={{ start: t("pickStart"), end: t("pickEnd") }}
      />
      <span role="status" className="text-xs text-ink-muted">
        {done}
      </span>

      <Modal open={range !== null} onClose={close} title={t("title")}>
        {range && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <p className="digits font-display text-base">{formatDayRange(range)}</p>
              <p className="text-sm text-ink-muted">
                {`${projectName ?? t("allProjects")} · ${team ? t("team") : t("mine")}`}
              </p>
            </div>

            <div aria-live="polite" className="digits flex min-h-12 flex-col gap-1 text-sm">
              {!preview && !error && <p className="text-ink-dim">{t("loading")}</p>}
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
                onClick={close}
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
        )}
      </Modal>
    </>
  );
}
