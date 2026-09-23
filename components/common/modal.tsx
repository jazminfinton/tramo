"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * A modal on the native <dialog>: `showModal()` brings focus trapping, Escape
 * and an inert page for free; the look is ours. Clicking the backdrop closes.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

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
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg bg-transparent p-0 text-ink opacity-0 transition-[opacity,scale,display,overlay] transition-discrete duration-200 ease-signature backdrop:bg-ground/70 backdrop:backdrop-blur-[1px] open:scale-100 open:opacity-100 starting:open:scale-95 starting:open:opacity-0 motion-reduce:transition-none"
    >
      <div className="panel grain p-5 sm:p-7">
        <h2 id={titleId} className="font-display text-lg font-medium">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
