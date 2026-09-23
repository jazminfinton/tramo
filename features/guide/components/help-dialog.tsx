"use client";

import { useTranslations } from "next-intl";

import { Modal } from "@/components/common/modal";
import type { TourStep } from "@/features/guide/tour";

type HelpDialogProps = {
  open: boolean;
  onClose: () => void;
  steps: TourStep[];
  status: "new" | "paused" | "done";
  /** The step "Retomar" opens: where the tour was left. */
  resumeAt: number;
  onStart: (index: number) => void;
};

/**
 * The help: what the tour covers, step by step, and the way into it. It
 * starts, resumes where it was left, or starts over; any step in the list
 * opens the tour right there.
 */
export function HelpDialog({ open, onClose, steps, status, resumeAt, onStart }: HelpDialogProps) {
  const t = useTranslations("help");
  const tSteps = useTranslations("tour.steps");
  const paused = status === "paused";

  return (
    <Modal open={open} onClose={onClose} title={t("title")}>
      <p className="text-sm leading-relaxed text-ink-muted">{t("intro")}</p>

      <p className="mt-5 font-display text-xs tracking-widest text-ink-dim uppercase">{t("steps")}</p>
      <ol className="mt-2 flex max-h-[40vh] flex-col overflow-y-auto">
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onStart(index)}
              className="flex w-full items-center gap-3 rounded-tile px-2 py-2 text-left text-sm transition-colors duration-150 ease-signature hover:bg-raised motion-reduce:transition-none"
            >
              <span className="digits flex size-6 flex-none items-center justify-center rounded-full bg-tile text-xs">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">{tSteps(`${step.id}.title`)}</span>
              {paused && index === resumeAt && <span className="flex-none text-xs text-accent">{t("leftHere")}</span>}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-tile px-4 py-2.5 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none"
        >
          {t("close")}
        </button>
        {paused && (
          <button
            type="button"
            onClick={() => onStart(0)}
            className="rounded-tile bg-raised px-4 py-2.5 font-display text-sm transition-colors duration-150 ease-signature hover:bg-tile motion-reduce:transition-none"
          >
            {t("restart")}
          </button>
        )}
        <button
          type="button"
          onClick={() => onStart(paused ? resumeAt : 0)}
          className="rounded-tile bg-accent px-4 py-2.5 font-display text-sm font-medium text-on-accent transition-opacity duration-150 ease-signature hover:opacity-90 motion-reduce:transition-none"
        >
          {paused ? t("resume", { step: resumeAt + 1, total: steps.length }) : status === "done" ? t("again") : t("start")}
        </button>
      </div>
    </Modal>
  );
}
