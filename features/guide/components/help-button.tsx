"use client";

import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";

import { useGuide } from "@/features/guide/components/tour-provider";

/** The "?" in the header: opens the help, where the tour starts or resumes. */
export function HelpButton() {
  const t = useTranslations("help");
  const { openHelp } = useGuide();

  return (
    <button
      type="button"
      data-tour="help-button"
      onClick={openHelp}
      aria-label={t("button")}
      aria-haspopup="dialog"
      className="flex size-10 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none"
    >
      <CircleHelp className="icon size-4" aria-hidden />
    </button>
  );
}
