"use client";

import { CircleDollarSign } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";

import { setDayPaidAction, setEntryPaidAction } from "@/features/time/paid-actions";
import type { PaidStatus } from "@/features/time/paid-status";
import type { ActionResult } from "@/lib/form";

/**
 * Runs a mark: it shows at once, and the page's next render confirms it, or
 * brings the old state back along with the error.
 */
function useMark<T>(current: T) {
  const [shown, setShown] = useOptimistic(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function mark(next: T, action: () => Promise<ActionResult>) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      setShown(next);
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return { shown, error, pending, mark };
}

// Floats under its button, so a rare error doesn't move the row around it.
function MarkError({ error }: { error: string | null }) {
  const t = useTranslations("paid.errors");
  if (!error) return null;
  return (
    <p
      role="alert"
      className="absolute top-full right-0 z-10 mt-1 w-max max-w-64 rounded-tile bg-raised px-3 py-2 text-xs text-warn shadow-lg shadow-black/20"
    >
      {t(error as "generic")}
    </p>
  );
}

type PaidEntryToggleProps = {
  entryId: string;
  paid: boolean;
  /** What the block is called, for its accessible name. */
  label: string;
  /** The look of the row's other buttons. */
  className: string;
};

/** Marks one block as paid, or takes the mark off. Its color says which, and the row says it in words. */
export function PaidEntryToggle({ entryId, paid, label, className }: PaidEntryToggleProps) {
  const t = useTranslations("paid");
  const { shown, error, pending, mark } = useMark(paid);

  return (
    <div className="relative flex-none">
      <button
        type="button"
        onClick={() => mark(!shown, () => setEntryPaidAction(entryId, !shown))}
        aria-disabled={pending}
        aria-label={shown ? t("unmarkEntry", { entry: label }) : t("markEntry", { entry: label })}
        data-paid={shown}
        className={`${className} data-[paid=true]:text-accent`}
      >
        <CircleDollarSign className="icon size-4" aria-hidden />
      </button>
      <MarkError error={error} />
    </div>
  );
}

const DAY_STATUS: Record<PaidStatus, string> = {
  paid: "bg-accent/15 text-accent hover:bg-accent/25",
  partial: "bg-accent/15 text-ink hover:bg-accent/25",
  unpaid: "bg-surface text-ink-muted hover:bg-raised hover:text-ink",
};

type PaidDayToggleProps = {
  /** The calendar day (ISO). */
  day: string;
  status: PaidStatus;
  /** The day in words, for its accessible name. */
  dayLabel: string;
  /** Marks the control for the guided tour (features/guide/tour.ts). */
  "data-tour"?: string;
};

/**
 * Says how a day stands and marks all of it at once: a day fully paid gets its
 * mark taken off, any other gets marked whole. The name says what's on screen
 * and what the click will do.
 */
export function PaidDayToggle({ day, status, dayLabel, "data-tour": tourKey }: PaidDayToggleProps) {
  const t = useTranslations("paid");
  const { shown, error, pending, mark } = useMark(status);
  const paid = shown === "paid";

  return (
    <div className="relative flex-none">
      <button
        type="button"
        data-tour={tourKey}
        onClick={() => mark(paid ? "unpaid" : "paid", () => setDayPaidAction(day, !paid))}
        aria-disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 font-display text-xs transition-colors duration-150 ease-signature motion-reduce:transition-none ${DAY_STATUS[shown]}`}
      >
        <CircleDollarSign className="icon size-3.5" aria-hidden />
        {t(`status.${shown}`)}
        <span className="sr-only">
          {`. ${paid ? t("unmarkDay", { day: dayLabel }) : t("markDay", { day: dayLabel })}`}
        </span>
      </button>
      <MarkError error={error} />
    </div>
  );
}
