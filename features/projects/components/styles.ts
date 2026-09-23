// Button styles shared by the project board. Literal strings, so Tailwind's
// scanner sees every class.

export const BUTTON_PRIMARY =
  "inline-flex items-center gap-2 rounded-tile bg-accent px-3 py-1.5 font-display text-sm font-medium text-on-accent transition-opacity duration-150 ease-signature hover:opacity-90 aria-disabled:cursor-wait aria-disabled:opacity-60 motion-reduce:transition-none";

export const BUTTON_SECONDARY =
  "inline-flex items-center gap-2 rounded-tile bg-raised px-3 py-1.5 font-display text-sm transition-colors duration-150 ease-signature hover:bg-tile motion-reduce:transition-none";

export const BUTTON_GHOST =
  "inline-flex items-center gap-2 rounded-tile px-3 py-1.5 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink aria-disabled:cursor-wait aria-disabled:opacity-60 motion-reduce:transition-none";

export const SEGMENT = (checked: boolean) =>
  `rounded-[5px] px-2 py-0.5 text-xs transition-colors duration-150 ease-signature motion-reduce:transition-none ${
    checked ? "bg-tile text-ink" : "text-ink-muted hover:text-ink"
  }`;
