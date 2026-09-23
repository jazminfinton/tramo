"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { useAnchoredPopover } from "@/components/common/use-anchored-popover";
import { typeaheadIndex } from "@/lib/search";

export type DropdownOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Secondary text at the end of the option ("1 h 30 min"). Not shown on the trigger. */
  hint?: string;
  /** More ways to reach the option by typing ("930" for 09:30). */
  keywords?: string[];
};

type DropdownProps = {
  /** Accessible name of the control; also names the list. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  /** What the trigger shows when no option matches `value`. */
  placeholder?: string;
  /** With a name, the value travels in a hidden input, like any form field. */
  name?: string;
  id?: string;
  "aria-invalid"?: true | undefined;
  "aria-describedby"?: string | undefined;
  className?: string;
  /** Numbers that get compared (times): tabular figures. */
  numeric?: boolean;
};

const OPEN_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", " "]);

/**
 * The system's select (ported from Fragua): a hand-built listbox following
 * the WAI-ARIA APG "select-only combobox" pattern, instead of a native
 * <select> that can't be styled or themed.
 *
 * Focus stays on the trigger while the menu is open (`aria-activedescendant`
 * points at the active option). Arrows move, Home/End jump, Enter/Space pick,
 * Escape and Tab close, and typing jumps to the option starting with it.
 *
 * The list opens in the top layer (useAnchoredPopover), so a dialog can't
 * clip it.
 */
export function Dropdown({
  label,
  value,
  onChange,
  options,
  placeholder,
  name,
  id,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  className = "",
  numeric = false,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const idBase = useId();
  const listId = `${idBase}-list`;
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typeahead = useRef({ buffer: "", time: 0 });
  const listRef = useAnchoredPopover<HTMLUListElement>({ open, anchor: triggerRef, matchWidth: true, gap: 4 });

  const selected = options.find((option) => option.value === value);
  const optionId = (index: number) => `${idBase}-option-${index}`;

  function openMenu() {
    const index = options.findIndex((option) => option.value === value);
    setActive(index === -1 ? 0 : index);
    setOpen(true);
  }

  function close(focusBack: boolean) {
    setOpen(false);
    setActive(-1);
    if (focusBack) triggerRef.current?.focus();
  }

  function select(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close(true);
  }

  function typeaheadTo(char: string) {
    const entry = typeahead.current;
    const now = Date.now();
    entry.buffer = now - entry.time < 500 ? entry.buffer + char : char;
    entry.time = now;
    const index = typeaheadIndex(options, entry.buffer);
    if (index !== -1) setActive(index);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (OPEN_KEYS.has(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((current) => Math.min(options.length - 1, current + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((current) => Math.max(0, current - 1));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        // Without preventDefault, the click the browser attaches to Enter and
        // Space on a button would reopen the menu right away.
        event.preventDefault();
        if (active >= 0) select(active);
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          typeaheadTo(event.key);
        }
    }
  }

  // A click outside closes without moving focus: the click takes it.
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

  // Keep the active option visible: arrows scroll the menu, not the page.
  useLayoutEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`${idBase}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, idBase]);

  return (
    <span ref={rootRef} className={`relative inline-flex ${className}`}>
      {name !== undefined && <input type="hidden" name={name} value={value} />}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        onClick={() => (open ? close(true) : openMenu())}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-tile bg-raised py-2.5 pr-2.5 pl-3 text-left text-sm transition-colors duration-150 ease-signature hover:bg-tile aria-expanded:bg-tile aria-invalid:outline-2 aria-invalid:outline-warn motion-reduce:transition-none"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon}
          <span className={`truncate ${numeric ? "digits" : ""}`}>{selected ? selected.label : (placeholder ?? "")}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={`icon size-4 flex-none text-ink-dim transition-transform duration-200 ease-signature motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          // Shown and placed by useAnchoredPopover.
          popover="manual"
          className="menu-pop fixed inset-auto m-0 max-h-72 w-max max-w-[calc(100vw-1rem)] overflow-y-auto rounded-tile border-0 bg-raised p-1 text-ink shadow-lg shadow-black/20"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={option.value === value}
              onMouseMove={() => setActive(index)}
              // Keeps focus on the trigger while clicking an option.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(index)}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-tile px-3 py-2.5 text-sm ${
                active === index ? "bg-ink/[0.07] text-ink" : "text-ink-muted"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {option.icon}
                <span className={`truncate ${numeric ? "digits" : ""}`}>{option.label}</span>
              </span>
              <span className="flex flex-none items-center gap-2">
                {option.hint && <span className="text-xs text-ink-dim">{option.hint}</span>}
                <Check
                  aria-hidden
                  className={`icon size-3.5 text-accent ${option.value === value ? "" : "invisible"}`}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
