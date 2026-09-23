"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";

import type { ActionResult } from "@/lib/form";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** "danger" paints the confirm button with the accent, for destructive actions. */
  tone?: "danger" | "default";
  pending?: boolean;
  /** Already-translated error. */
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * A confirmation modal built on the native <dialog> (ported from Fragua).
 * `showModal()` brings focus trapping, Escape to close and an inert page for
 * free; the look is entirely ours. While the action runs it can't be closed.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "default",
  pending = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      // A click on the dialog element itself is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
      className="m-auto w-[calc(100%-3rem)] max-w-md bg-transparent p-0 text-ink opacity-0 transition-[opacity,scale,display,overlay] transition-discrete duration-200 ease-signature backdrop:bg-ground/70 backdrop:backdrop-blur-[1px] open:scale-100 open:opacity-100 starting:open:scale-95 starting:open:opacity-0 motion-reduce:transition-none"
    >
      <div className="panel grain p-6 sm:p-8">
        <h2 id={titleId} className="font-display text-xl font-medium">
          {title}
        </h2>
        <div id={descriptionId} className="mt-3 text-sm leading-relaxed text-ink-muted">
          {description}
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-tile bg-warn/10 px-4 py-3 text-sm text-warn">
            {error}
          </p>
        )}

        <div className="mt-8 flex justify-end gap-3">
          {/* Focus starts on Cancel, the safe option. */}
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={pending}
            className="rounded-tile px-4 py-2.5 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-tile px-4 py-2.5 font-display text-sm font-medium transition-opacity duration-150 ease-signature hover:opacity-90 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none ${
              tone === "danger" ? "bg-accent text-on-accent" : "bg-tile"
            }`}
          >
            {pending ? t("processing") : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

type ConfirmButtonProps = {
  children: ReactNode;
  className?: string;
  /** Accessible name when the trigger is icon-only. */
  label?: string;
  dialogTitle: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  /** Runs on confirm. Returning `{ error }` keeps the dialog open and shows it. */
  onConfirm: () => Promise<ActionResult | void>;
  /** Turns an error key from the action into text. */
  translateError: (key: string) => string;
};

/** A trigger wired to a ConfirmDialog: the usual shape of a destructive action. */
export function ConfirmButton({
  children,
  className = "",
  label,
  dialogTitle,
  description,
  confirmLabel,
  tone,
  onConfirm,
  translateError,
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await onConfirm();
      if (result?.error) {
        setError(translateError(result.error));
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label={label}
        className={className}
      >
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title={dialogTitle}
        description={description}
        confirmLabel={confirmLabel}
        tone={tone}
        pending={pending}
        error={error}
        onConfirm={confirm}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
