"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { Dropdown } from "@/components/common/dropdown";
import { useAnchoredPopover } from "@/components/common/use-anchored-popover";
import {
  addMonths,
  formatDateInput,
  fromIsoDate,
  isSameDay,
  monthGrid,
  monthLabel,
  monthNames,
  parseDateInput,
  toIsoDate,
  weekdayNames,
} from "@/lib/dates";

type DateFieldProps = {
  /** ISO date (`2026-12-31`), or "" when empty or unreadable. */
  value: string;
  onChange: (isoDate: string) => void;
  label: string;
  /** With a name, the ISO value travels in a hidden input, like `<input type="date">`. */
  name?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

/**
 * A date field with our own calendar (ported from Fragua).
 *
 * The native date input opens the system calendar, which lives outside the
 * theme. The rule is "type native, pick custom": the text input stays (mobile
 * keyboards and autofill come free) and only the grid is replaced — the part
 * that shows options. WAI-ARIA APG "Date Picker Dialog" pattern.
 */
export function DateField({
  value,
  onChange,
  label,
  name,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: DateFieldProps) {
  const t = useTranslations("dateField");
  const locale = useLocale();
  const idBase = useId();
  const gridId = `${idBase}-grid`;
  const inputId = id ?? `${idBase}-input`;

  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const activeCell = useRef<HTMLButtonElement>(null);

  const selected = fromIsoDate(value);
  const [text, setText] = useState(selected ? formatDateInput(selected) : "");
  const [open, setOpen] = useState(false);
  // The day holding focus inside the grid: the selected one, or today.
  const [focused, setFocused] = useState<Date>(() => selected ?? new Date());

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  function choose(day: Date) {
    setText(formatDateInput(day));
    setFocused(day);
    onChange(toIsoDate(day));
    close(true);
  }

  // What's typed rules while typing: a date is adopted; anything else stays
  // written as-is so the person can fix it, and the value becomes empty.
  function onType(next: string) {
    setText(next);
    const date = parseDateInput(next);
    onChange(date ? toIsoDate(date) : "");
    if (date) setFocused(date);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Focus follows the grid only when the KEYBOARD moved it, so picking a
  // month in the dropdown doesn't yank focus out of the dropdown.
  const followFocus = useRef(false);

  useLayoutEffect(() => {
    if (!open || !followFocus.current) return;
    followFocus.current = false;
    activeCell.current?.focus();
  }, [open, focused]);

  // The calendar opens in the top layer, so a dialog can't clip it.
  const calendar = useAnchoredPopover<HTMLDivElement>({ open, anchor: root });

  // Opening moves focus into the grid, on the focused day.
  useLayoutEffect(() => {
    if (open) activeCell.current?.focus();
  }, [open]);

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const move = (days: number) => {
      event.preventDefault();
      followFocus.current = true;
      const next = new Date(focused);
      next.setDate(focused.getDate() + days);
      setFocused(next);
    };

    switch (event.key) {
      case "ArrowLeft":
        return move(-1);
      case "ArrowRight":
        return move(1);
      case "ArrowUp":
        return move(-7);
      case "ArrowDown":
        return move(7);
      case "Home":
        return move(-((focused.getDay() + 6) % 7));
      case "End":
        return move(6 - ((focused.getDay() + 6) % 7));
      case "PageUp":
        event.preventDefault();
        followFocus.current = true;
        return setFocused(addMonths(focused, event.shiftKey ? -12 : -1));
      case "PageDown":
        event.preventDefault();
        followFocus.current = true;
        return setFocused(addMonths(focused, event.shiftKey ? 12 : 1));
      default:
        return;
    }
  }

  const grid = monthGrid(focused.getFullYear(), focused.getMonth());
  const today = new Date();
  const months = monthNames(locale).map((monthName, index) => ({ value: `${index}`, label: monthName }));
  const firstYear = Math.min(today.getFullYear() - 5, focused.getFullYear());
  const lastYear = Math.max(today.getFullYear() + 1, focused.getFullYear());
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => ({
    value: `${firstYear + index}`,
    label: `${firstYear + index}`,
  }));

  return (
    <div ref={root} className="relative">
      {name !== undefined && <input type="hidden" name={name} value={value} />}

      <div className="flex items-center gap-2">
        <input
          id={inputId}
          value={text}
          onChange={(event) => onType(event.target.value)}
          placeholder={t("placeholder")}
          inputMode="numeric"
          autoComplete="off"
          aria-label={label}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="w-36 rounded-tile bg-raised px-3 py-2.5 text-sm placeholder:text-ink-dim aria-invalid:outline-2 aria-invalid:outline-warn"
        />
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          aria-label={open ? t("closeCalendar") : t("openCalendar")}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? gridId : undefined}
          className="inline-flex size-10 items-center justify-center rounded-tile bg-raised transition-colors duration-150 ease-signature hover:bg-tile motion-reduce:transition-none"
        >
          <CalendarDays className="icon size-4" aria-hidden />
        </button>
      </div>

      {open && (
        <div
          ref={calendar}
          // Shown and placed by useAnchoredPopover.
          popover="manual"
          role="dialog"
          aria-label={label}
          // Escape closes from anywhere in the calendar. The guard is for the
          // month and year dropdowns, which handle their own Escape first.
          onKeyDown={(event) => {
            if (event.key !== "Escape" || event.defaultPrevented) return;
            event.preventDefault();
            close(true);
          }}
          // Undo the browser's popover defaults (centered, bordered, scrolling)
          // for our own panel; top/left are set by useAnchoredPopover.
          className="panel menu-pop fixed inset-auto m-0 w-80 max-w-[calc(100vw-1rem)] overflow-visible border-0 p-4 text-ink shadow-lg shadow-black/25"
        >
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => setFocused(addMonths(focused, -1))}
              aria-label={t("previousMonth")}
              className="inline-flex size-8 flex-none items-center justify-center rounded-tile transition-colors duration-150 ease-signature hover:bg-raised motion-reduce:transition-none"
            >
              <ChevronLeft className="icon size-4" aria-hidden />
            </button>
            <div className="flex items-center gap-1.5">
              <Dropdown
                label={t("month")}
                value={`${focused.getMonth()}`}
                onChange={(month) => setFocused(addMonths(focused, Number(month) - focused.getMonth()))}
                options={months}
                className="w-32"
              />
              <Dropdown
                label={t("year")}
                value={`${focused.getFullYear()}`}
                onChange={(year) => setFocused(addMonths(focused, (Number(year) - focused.getFullYear()) * 12))}
                options={years}
                className="w-24"
              />
            </div>
            <button
              type="button"
              onClick={() => setFocused(addMonths(focused, 1))}
              aria-label={t("nextMonth")}
              className="inline-flex size-8 flex-none items-center justify-center rounded-tile transition-colors duration-150 ease-signature hover:bg-raised motion-reduce:transition-none"
            >
              <ChevronRight className="icon size-4" aria-hidden />
            </button>
          </div>

          <div id={gridId} role="grid" aria-label={monthLabel(focused, locale)} onKeyDown={onGridKeyDown} className="mt-3">
            <div role="row" className="grid grid-cols-7">
              {weekdayNames(locale).map((weekday) => (
                <span key={weekday} role="columnheader" className="py-1 text-center font-display text-xs text-ink-dim">
                  {weekday}
                </span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, week) => (
              <div role="row" key={week} className="grid grid-cols-7">
                {grid.slice(week * 7, week * 7 + 7).map((day) => {
                  const inMonth = day.getMonth() === focused.getMonth();
                  const isSelected = selected !== null && isSameDay(day, selected);
                  const hasFocus = isSameDay(day, focused);
                  const isToday = isSameDay(day, today);

                  return (
                    <span role="gridcell" aria-selected={isSelected} key={toIsoDate(day)}>
                      <button
                        ref={hasFocus ? activeCell : undefined}
                        type="button"
                        // Roving: only the focused day is tabbable, so Tab
                        // leaves the grid instead of walking 42 buttons.
                        tabIndex={hasFocus ? 0 : -1}
                        onClick={() => choose(day)}
                        aria-current={isToday ? "date" : undefined}
                        className={`digits w-full rounded-tile py-1.5 text-center text-sm transition-colors duration-150 ease-signature motion-reduce:transition-none ${
                          isSelected ? "bg-accent text-on-accent" : "hover:bg-raised"
                        } ${inMonth ? "" : "text-ink-dim"} ${isToday && !isSelected ? "outline-1 outline-ink-dim" : ""}`}
                      >
                        {day.getDate()}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="hairline-t mt-3 flex justify-end pt-3">
            <button
              type="button"
              onClick={() => choose(new Date())}
              className="font-display text-xs text-ink-muted transition-colors duration-150 ease-signature hover:text-ink motion-reduce:transition-none"
            >
              {t("today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
