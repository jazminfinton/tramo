"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useState, useTransition, type ReactNode } from "react";

import { announceNavigation } from "@/components/global/navigation-progress";
import { saveTourStepAction } from "@/features/guide/actions";
import { HelpDialog } from "@/features/guide/components/help-dialog";
import { TourOverlay } from "@/features/guide/components/tour-overlay";
import { resumeIndex, tourStatus, type TourStep } from "@/features/guide/tour";

type Guide = { openHelp: () => void };

const GuideContext = createContext<Guide | null>(null);

/** For the help button: it opens the help, the way into the tour. */
export function useGuide(): Guide {
  const guide = use(GuideContext);
  if (!guide) throw new Error("useGuide needs a TourProvider above it.");
  return guide;
}

type TourProviderProps = {
  steps: TourStep[];
  /** Where the person left the tour, from their account (null: never touched it). */
  saved: number | null;
  children: ReactNode;
};

/**
 * Runs the guided tour and the help dialog for the signed-in app. It lives
 * in the (app) layout, so a tour that walks across pages keeps going while
 * they change underneath it.
 *
 * The first visit to the home page starts it on its own. Every move (next,
 * back, skip, finish) is saved on the account, so "Retomar" picks up there on
 * any device; until the person touches it, it keeps greeting them.
 */
export function TourProvider({ steps, saved: initialSaved, children }: TourProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialSaved);
  const [index, setIndex] = useState<number | null>(() => (initialSaved === null && pathname === "/" ? 0 : null));
  const [helpOpen, setHelpOpen] = useState(false);
  // The step whose page is being brought in: its target may take a moment to appear.
  const [arriving, setArriving] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function save(step: number) {
    setSaved(step);
    startTransition(async () => {
      await saveTourStepAction(step);
    });
  }

  // Shows a step, bringing its page first when it lives on another one.
  function show(next: number) {
    const step = steps[next];
    if (!step) return;
    setIndex(next);
    const navigates = step.path !== null && step.path !== pathname;
    setArriving(navigates ? next : null);
    if (step.path && navigates) {
      announceNavigation();
      router.push(step.path);
    }
  }

  function start(from: number) {
    setHelpOpen(false);
    // The tour is modal: whatever else is open (the help, the phone's menu) closes.
    for (const dialog of document.querySelectorAll<HTMLDialogElement>("dialog[open]")) dialog.close();
    show(from);
    save(from);
  }

  function next() {
    if (index === null) return;
    if (index >= steps.length - 1) {
      setIndex(null);
      save(steps.length);
      return;
    }
    show(index + 1);
    save(index + 1);
  }

  function back() {
    if (index === null || index === 0) return;
    show(index - 1);
    save(index - 1);
  }

  function skip() {
    if (index === null) return;
    setIndex(null);
    save(index);
  }

  const step = index === null ? undefined : steps[index];

  return (
    <GuideContext value={{ openHelp: () => setHelpOpen(true) }}>
      {children}
      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        steps={steps}
        status={tourStatus(saved, steps.length)}
        resumeAt={resumeIndex(saved, steps.length)}
        onStart={start}
      />
      {step && index !== null && (
        <TourOverlay
          step={step}
          index={index}
          total={steps.length}
          waitForTarget={arriving === index}
          onNext={next}
          onBack={back}
          onSkip={skip}
        />
      )}
    </GuideContext>
  );
}
