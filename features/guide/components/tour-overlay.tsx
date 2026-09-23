"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";

import type { TourStep } from "@/features/guide/tour";
import { placeCard, type Box } from "@/lib/placement";

/** Room around the target inside the spotlight, and the spotlight's distance from the edges. */
const PAD = 8;
/** How long a step on a page that's still arriving waits for its target before showing centered. */
const WAIT_MS = 2500;

/** The first element on screen marked with one of the keys, by preference. */
function findTarget(keys: string[]): HTMLElement | null {
  for (const key of keys) {
    for (const element of document.querySelectorAll<HTMLElement>(`[data-tour~="${key}"]`)) {
      if (element.getClientRects().length > 0) return element;
    }
  }
  return null;
}

// The target's box plus some room, kept inside the viewport so a tall target
// (the projects board) still shows its whole outline.
function spotlightBox(rect: DOMRect): Box {
  const top = Math.max(PAD, rect.top - PAD);
  const left = Math.max(PAD, rect.left - PAD);
  const bottom = Math.min(window.innerHeight - PAD, rect.bottom + PAD);
  const right = Math.min(window.innerWidth - PAD, rect.right + PAD);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

type TourOverlayProps = {
  step: TourStep;
  index: number;
  total: number;
  /** Its page is being brought in: give the target a moment to appear before centering. */
  waitForTarget: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

/**
 * One step of the tour: the page dims except for a spotlight on what to
 * touch, and a card next to it explains it. A native modal <dialog>, so focus
 * stays in the card, the page can't be clicked by accident, and Escape skips.
 *
 * Positions are written straight onto the spotlight and the card every frame
 * while the tour is open, so they follow scrolling, resizing and a page that
 * is still arriving, without re-rendering React sixty times a second.
 */
export function TourOverlay({ step, index, total, waitForTarget, onNext, onBack, onSkip }: TourOverlayProps) {
  const t = useTranslations("tour");
  const dialog = useRef<HTMLDialogElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const last = index === total - 1;

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const started = performance.now();
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scrolled = false;
    let frame = 0;

    function tick() {
      const spotlight = spot.current;
      const panel = card.current;
      if (spotlight && panel) {
        const target = findTarget(step.targets);
        if (target && !scrolled) {
          target.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
          scrolled = true;
        }
        // A target that isn't there (the floating timer on a phone) centers the card right away.
        const waiting = !target && waitForTarget && step.targets.length > 0 && performance.now() - started < WAIT_MS;
        const box = target ? spotlightBox(target.getBoundingClientRect()) : null;
        const viewport = { width: window.innerWidth, height: window.innerHeight };

        // No target: a spotlight of no size in the middle, so its shadow dims everything.
        const hole = box ?? { top: viewport.height / 2, left: viewport.width / 2, width: 0, height: 0 };
        spotlight.dataset.hole = box ? "true" : "false";
        spotlight.style.top = `${hole.top}px`;
        spotlight.style.left = `${hole.left}px`;
        spotlight.style.width = `${hole.width}px`;
        spotlight.style.height = `${hole.height}px`;

        const size = panel.getBoundingClientRect();
        const { top, left } = placeCard(box, size, viewport);
        panel.style.top = `${Math.round(top)}px`;
        panel.style.left = `${Math.round(left)}px`;
        panel.style.visibility = waiting ? "hidden" : "visible";
        // Focus lives in the card, on "Siguiente" unless the person moved it
        // (autoFocus can't do it: the card is hidden until it's placed).
        if (!waiting && !panel.contains(document.activeElement)) nextButton.current?.focus({ preventScroll: true });
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step, waitForTarget]);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "ArrowRight") onNext();
    if (event.key === "ArrowLeft" && index > 0) onBack();
  }

  const title = t(`steps.${step.id}.title`);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape skips (and can be resumed from the help button) instead of
      // just closing the dialog behind the tour's back.
      onCancel={(event) => {
        event.preventDefault();
        onSkip();
      }}
      onKeyDown={onKeyDown}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:bg-transparent"
    >
      <div
        ref={spot}
        aria-hidden
        className="pointer-events-none fixed rounded-[12px] outline-2 outline-accent data-[hole=false]:outline-transparent"
        style={{ boxShadow: "0 0 0 200vmax color-mix(in oklab, var(--color-ground) 72%, transparent)" }}
      />

      <div
        ref={card}
        className="panel grain invisible fixed w-[min(22rem,calc(100vw-2rem))] p-5 shadow-lg shadow-black/30"
      >
        {/* Keyed by step: each new step gently pops in. */}
        <div key={index} className="menu-pop">
          <p className="digits font-display text-xs text-ink-dim">{t("progress", { current: index + 1, total })}</p>
          <h2 id={titleId} className="mt-2 font-display text-base font-medium">
            {title}
          </h2>
          <p id={bodyId} className="mt-2 text-sm leading-relaxed text-ink-muted">
            {t(`steps.${step.id}.body`)}
          </p>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-tile px-3 py-2 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none"
          >
            {t("skip")}
          </button>
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-tile bg-raised px-3 py-2 font-display text-sm transition-colors duration-150 ease-signature hover:bg-tile motion-reduce:transition-none"
              >
                {t("back")}
              </button>
            )}
            <button
              ref={nextButton}
              type="button"
              onClick={onNext}
              className="rounded-tile bg-accent px-4 py-2 font-display text-sm font-medium text-on-accent transition-opacity duration-150 ease-signature hover:opacity-90 motion-reduce:transition-none"
            >
              {last ? t("done") : t("next")}
            </button>
          </div>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {`${t("progress", { current: index + 1, total })}: ${title}`}
      </p>
    </dialog>
  );
}
