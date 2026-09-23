"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { toSearchKey } from "@/lib/search";

type AutocompleteProps = {
  /** Accessible name of the input. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Candidate values, in the order to show them (e.g. most recent first). */
  suggestions: readonly string[];
  placeholder?: string;
  name?: string;
  maxLength?: number;
  /** Enter with no suggestion highlighted (e.g. start the timer). */
  onSubmit?: () => void;
  className?: string;
  inputClassName?: string;
};

const MAX_SHOWN = 8;

/**
 * Free text with suggestions: the WAI-ARIA APG "combobox with list
 * autocomplete" pattern. The value is whatever is typed; suggestions only
 * help reuse past entries, so "fix login" and "Fix Login" stop becoming two
 * different tasks in the metrics. Matching ignores accents and case.
 *
 * Arrows move through suggestions, Enter picks the highlighted one (or calls
 * onSubmit when none is), Escape and Tab close the list.
 */
export function Autocomplete({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  name,
  maxLength,
  onSubmit,
  className = "",
  inputClassName = "",
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const idBase = useId();
  const listId = `${idBase}-list`;
  const rootRef = useRef<HTMLSpanElement>(null);

  const key = toSearchKey(value);
  const shown = suggestions
    .filter((suggestion) => {
      const candidate = toSearchKey(suggestion);
      return candidate !== key && candidate.includes(key);
    })
    .slice(0, MAX_SHOWN);
  const expanded = open && shown.length > 0;
  const optionId = (index: number) => `${idBase}-option-${index}`;

  function pick(index: number) {
    const suggestion = shown[index];
    if (suggestion === undefined) return;
    onChange(suggestion);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        setActive((current) => (shown.length === 0 ? -1 : Math.min(shown.length - 1, current + 1)));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((current) => Math.max(-1, current - 1));
        break;
      case "Enter":
        event.preventDefault();
        if (expanded && active >= 0) {
          pick(active);
        } else {
          setOpen(false);
          onSubmit?.();
        }
        break;
      case "Escape":
        if (expanded) {
          event.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        break;
      case "Tab":
        setOpen(false);
        setActive(-1);
        break;
    }
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!expanded || active < 0) return;
    document.getElementById(`${idBase}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [expanded, active, idBase]);

  return (
    <span ref={rootRef} className={`relative flex ${className}`}>
      <input
        type="text"
        name={name}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={inputClassName}
      />

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="menu-pop absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-tile bg-raised p-1 shadow-lg shadow-black/20"
        >
          {shown.map((suggestion, index) => (
            <li
              key={suggestion}
              id={optionId(index)}
              role="option"
              aria-selected={active === index}
              onMouseMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(index)}
              className={`cursor-pointer truncate rounded-tile px-3 py-2.5 text-sm ${
                active === index ? "bg-ink/[0.07] text-ink" : "text-ink-muted"
              }`}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
