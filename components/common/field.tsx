"use client";

import { useId, type ReactNode } from "react";

// Base classes for a text input. The invalid state is styled from
// `aria-invalid`, so the attribute screen readers announce and the one that
// drives the style are the same: they can't drift apart. It's an outline, not
// a border: borders are reserved for shapes that truly need one.
export const FIELD =
  "w-full rounded-tile bg-raised px-3 py-2.5 text-sm placeholder:text-ink-dim aria-invalid:outline-2 aria-invalid:outline-warn";

export const FIELD_LABEL = "font-display text-xs tracking-widest text-ink-dim uppercase";

type FieldControlProps = {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
  "aria-required": true | undefined;
};

type FieldProps = {
  label: string;
  /** Already-translated error message. */
  error?: string;
  // Marks the field as required with a visible asterisk and `aria-required`.
  // Never the HTML `required` attribute, which brings back the browser's
  // native (unstyled, untranslated) validation bubble.
  required?: boolean;
  hint?: ReactNode;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
};

/**
 * A form field with its label, hint and error. The control is a render
 * function that receives the accessibility wiring already built
 * (`aria-invalid`, `aria-describedby`), which is exactly what gets forgotten
 * when every screen writes it by hand. The error has `role="alert"`, so it's
 * announced without moving focus.
 */
export function Field({ label, error, required, hint, className = "", children }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
        {required && (
          <span aria-hidden className="ml-1 text-accent">
            *
          </span>
        )}
      </label>
      <div className="mt-2">
        {children({
          id,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy,
          "aria-required": required ? true : undefined,
        })}
      </div>
      {hint && (
        <p id={hintId} className="mt-2 text-xs leading-relaxed text-ink-dim">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-xs leading-relaxed text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

/** The group version: a fieldset with its legend, for controls that aren't one input. */
export function FieldGroup({
  label,
  error,
  hint,
  className = "",
  children,
}: Omit<FieldProps, "children" | "required"> & { children: ReactNode }) {
  return (
    <fieldset className={className}>
      <legend className={FIELD_LABEL}>{label}</legend>
      {hint && <p className="mt-2 text-xs leading-relaxed text-ink-dim">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-warn">
          {error}
        </p>
      )}
    </fieldset>
  );
}
