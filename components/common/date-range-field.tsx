"use client";

import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Dropdown } from "@/components/common/dropdown";
import { useAnchoredPopover } from "@/components/common/use-anchored-popover";
import { formatDayRange, isPickable, openingMonth, positionIn, rangeOf, type DayRange } from "@/lib/date-range";
import {
  addMonths,
  calendarKeyTarget,
  fromIsoDate,
  isSameDay,
  monthGrid,
  monthLabel,
  monthNames,
  monthsShowing,
  toIsoDate,
  weekdayNames,
} from "@/lib/dates";

type DateRangeFieldProps = {
  /** Accessible name of the control and of its calendar. */
  label: string;
  /** The range in effect (ISO days, both included): what the calendar opens on. Null before there is one. */
  value: DayRange | null;
  /** Called once per range, with its days in order, when the second one is picked. */
  onChange: (range: DayRange) => void;
  /**
   * Whether `value` was picked here. When something else chose the range (a
   * preset next to this control), the trigger shows `placeholder` instead.
   */
  picked: boolean;
  placeholder: string;
  /** The last day that can be picked (ISO). */
  max?: string;
  /** The most days a range can cover. */
  maxDays?: number;
  /** The trigger's icon, for a calendar that does something else with the range. */
  icon?: ReactNode;
  /** What the calendar asks for at each step, when it isn't the usual. */
  hints?: { start: string; end: string };
  /** It can't open yet, because something has to be chosen first: `placeholder` says what. */
  disabled?: boolean;
  /** Takes the whole row and the look of a form's fields, for use inside a form. */
  field?: boolean;
  /** Drawn under a day's number, in a slot that keeps every day the same size. `onAccent`: the day wears the range's color. */
  renderDayMark?: (day: string, onAccent: boolean) => ReactNode;
  /** What that mark says, for screen readers. */
  describeDay?: (day: string) => string | undefined;
  /** Told which months are on show, each time they change: the first of them and how many. */
  onViewChange?: (first: Date, count: number) => void;
  /** What the marks mean, at the foot of the calendar. */
  legend?: ReactNode;
  /** Marks the trigger for the guided tour (features/guide/tour.ts). */
  "data-tour"?: string;
  className?: string;
};

// From this width up there's room for two months side by side.
const TWO_MONTHS = "(min-width: 720px)";

const NAV_BUTTON =
  "inline-flex size-8 flex-none items-center justify-center rounded-tile transition-colors duration-150 ease-signature hover:bg-raised aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent motion-reduce:transition-none";

/**
 * Picks a range of days on a calendar of our own, next to `DateField` and by
 * its rules (WAI-ARIA APG "Date Picker Dialog"): the first day picked starts
 * the range, the second one ends it and closes the calendar. The two can be
 * picked in either order, and while the second is pending the range follows
 * the pointer or the focus, so it shows before it's chosen.
 *
 * Two months show side by side where they fit, one on a phone. Each grid only
 * draws its own month, so no day shows twice.
 */
export function DateRangeField({
  label,
  value,
  onChange,
  picked,
  placeholder,
  max,
  maxDays,
  icon,
  hints,
  disabled = false,
  field = false,
  renderDayMark,
  describeDay,
  onViewChange,
  legend,
  "data-tour": tourKey,
  className = "",
}: DateRangeFieldProps) {
  const t = useTranslations("dateRange");
  const tCalendar = useTranslations("dateField");
  const locale = useLocale();
  const dialogId = useId();

  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const activeCell = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  // How many months are on show: decided when the calendar opens, by the room there is.
  const [months, setMonths] = useState(1);
  // The first of the months on show.
  const [view, setView] = useState(() => new Date());
  // The day holding focus inside the grid.
  const [focused, setFocused] = useState(() => new Date());
  // The first day picked, while the second one is still to come.
  const [anchor, setAnchor] = useState<string | null>(null);
  // The day under the pointer or the focus: where the range would end.
  const [reach, setReach] = useState<string | null>(null);

  const limit = max === undefined ? null : fromIsoDate(max);
  // The last month the view can start on: past it there's nothing to pick.
  const latest = limit ? addMonths(monthsShowing(limit, 1, limit), 1 - months) : null;
  const limits = { max, anchor, maxDays };

  function openCalendar() {
    const count = window.matchMedia(TWO_MONTHS).matches ? 2 : 1;
    setMonths(count);
    setView(openingMonth(value, count, max));
    // The range's last day, or the last one on offer when it ends past it or there's no range.
    setFocused((value && (max === undefined || value.to <= max) ? fromIsoDate(value.to) : limit) ?? new Date());
    setAnchor(null);
    setReach(null);
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    setAnchor(null);
    setReach(null);
    if (returnFocus) trigger.current?.focus();
  }

  function pick(day: string) {
    if (!isPickable(day, limits)) return;
    if (anchor === null) {
      setAnchor(day);
      setReach(day);
      return;
    }
    close(true);
    onChange(rangeOf(anchor, day));
  }

  // Turns the months on show, and the focused day with them, so Tab still
  // finds a day inside the grid. Neither goes past the last day on offer.
  function turn(by: number) {
    const wanted = addMonths(view, by);
    const next = latest && wanted > latest ? latest : wanted;
    const turned = (next.getFullYear() - view.getFullYear()) * 12 + next.getMonth() - view.getMonth();
    const day = addMonths(focused, turned);
    setView(next);
    setFocused(limit && day > limit ? limit : day);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (root.current?.contains(event.target as Node)) return;
      setOpen(false);
      setAnchor(null);
      setReach(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const announceView = useEffectEvent(() => onViewChange?.(view, months));

  useEffect(() => {
    if (open) announceView();
  }, [open, view, months]);

  // Focus follows the grid only when the KEYBOARD moved it, so picking a
  // month in the dropdown doesn't yank focus out of the dropdown.
  const followFocus = useRef(false);

  useLayoutEffect(() => {
    if (!open || !followFocus.current) return;
    followFocus.current = false;
    activeCell.current?.focus();
  }, [open, focused]);

  // The calendar opens in the top layer, so nothing around it can clip it.
  const calendar = useAnchoredPopover<HTMLDivElement>({ open, anchor: root });

  // Opening moves focus into the grid, on the focused day.
  useLayoutEffect(() => {
    if (open) activeCell.current?.focus();
  }, [open]);

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = calendarKeyTarget(focused, event.key, event.shiftKey);
    if (!target) return;
    event.preventDefault();
    // The keyboard stops at the last day on offer, like the pointer does.
    const next = limit && target > limit ? limit : target;
    followFocus.current = true;
    setFocused(next);
    setView(monthsShowing(view, months, next));
  }

  const today = new Date();
  // While the second day is pending, the range reaches wherever the pointer is.
  const shown = anchor ? rangeOf(anchor, reach ?? anchor) : value;
  const weekdays = weekdayNames(locale);
  const monthOptions = monthNames(locale).map((monthName, index) => ({ value: `${index}`, label: monthName }));
  const firstYear = Math.min(today.getFullYear() - 5, view.getFullYear());
  const lastYear = Math.max(limit?.getFullYear() ?? today.getFullYear() + 1, view.getFullYear());
  const yearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => ({
    value: `${firstYear + index}`,
    label: `${firstYear + index}`,
  }));
  const atLatest = latest !== null && view >= latest;

  return (
    <div ref={root} className={`relative ${field ? "flex w-full" : "inline-flex"} ${className}`}>
      <button
        ref={trigger}
        type="button"
        data-tour={tourKey}
        onClick={() => {
          if (disabled) return;
          if (open) close(false);
          else openCalendar();
        }}
        aria-disabled={disabled || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        className={`items-center gap-2 rounded-tile text-sm transition-colors duration-150 ease-signature motion-reduce:transition-none ${
          field
            ? "flex w-full bg-raised py-2.5 pr-2.5 pl-3 text-left hover:bg-tile aria-disabled:cursor-not-allowed aria-disabled:text-ink-dim aria-disabled:hover:bg-raised aria-expanded:bg-tile"
            : `inline-flex h-10 px-3 font-display ${picked ? "bg-tile text-ink" : "bg-surface text-ink-muted hover:text-ink aria-expanded:text-ink"}`
        }`}
      >
        {icon ?? <CalendarRange className="icon size-4 flex-none" aria-hidden />}
        <span className="sr-only">{`${label}: `}</span>
        <span className={picked ? "digits" : ""}>{picked && value ? formatDayRange(value) : placeholder}</span>
      </button>

      {open && (
        <div
          ref={calendar}
          id={dialogId}
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
          className={`panel menu-pop fixed inset-auto m-0 max-w-[calc(100vw-1rem)] overflow-visible border-0 p-4 text-ink shadow-lg shadow-black/25 ${
            months === 2 ? "w-[40rem]" : "w-80"
          }`}
        >
          <div className={`grid gap-6 ${months === 2 ? "grid-cols-2" : ""}`}>
            {Array.from({ length: months }, (_, index) => {
              const month = addMonths(view, index);
              const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
              const grid = monthGrid(month.getFullYear(), month.getMonth());

              return (
                // Keyed by place, not by month: turning the months must not
                // remount the button that was just clicked.
                <div key={index}>
                  <div className="flex h-10 items-center justify-between gap-1">
                    {index === 0 ? (
                      <button
                        type="button"
                        onClick={() => turn(-1)}
                        aria-label={tCalendar("previousMonth")}
                        className={NAV_BUTTON}
                      >
                        <ChevronLeft className="icon size-4" aria-hidden />
                      </button>
                    ) : (
                      <span aria-hidden className="size-8 flex-none" />
                    )}

                    {index === 0 ? (
                      <div className="flex items-center gap-1.5">
                        <Dropdown
                          label={tCalendar("month")}
                          value={`${month.getMonth()}`}
                          onChange={(next) => turn(Number(next) - month.getMonth())}
                          options={monthOptions}
                          className="w-32"
                        />
                        <Dropdown
                          label={tCalendar("year")}
                          value={`${month.getFullYear()}`}
                          onChange={(next) => turn((Number(next) - month.getFullYear()) * 12)}
                          options={yearOptions}
                          className="w-24"
                        />
                      </div>
                    ) : (
                      // The grid below carries the same name for screen readers.
                      <p aria-hidden className="font-display text-sm first-letter:uppercase">
                        {monthLabel(month, locale)}
                      </p>
                    )}

                    {index === months - 1 ? (
                      <button
                        type="button"
                        onClick={() => !atLatest && turn(1)}
                        aria-label={tCalendar("nextMonth")}
                        aria-disabled={atLatest || undefined}
                        className={NAV_BUTTON}
                      >
                        <ChevronRight className="icon size-4" aria-hidden />
                      </button>
                    ) : (
                      <span aria-hidden className="size-8 flex-none" />
                    )}
                  </div>

                  <div role="grid" aria-label={monthLabel(month, locale)} onKeyDown={onGridKeyDown} className="mt-3">
                    <div role="row" className="grid grid-cols-7">
                      {weekdays.map((weekday) => (
                        <span key={weekday} role="columnheader" className="py-1 text-center font-display text-xs text-ink-dim">
                          {weekday}
                        </span>
                      ))}
                    </div>
                    {Array.from({ length: 6 }, (_, week) => (
                      <div role="row" key={week} className="mt-0.5 grid grid-cols-7">
                        {grid.slice(week * 7, week * 7 + 7).map((day, weekday) => {
                          const isoDay = toIsoDate(day);
                          // Days of the months around stay blank: the next grid draws them.
                          if (day.getMonth() !== month.getMonth()) return <span role="gridcell" key={isoDay} />;

                          const position = positionIn(isoDay, shown);
                          const atEnd = position === "start" || position === "end" || position === "only";
                          const between = position !== "outside" && position !== "only";
                          const pickable = isPickable(isoDay, limits);
                          const hasFocus = isSameDay(day, focused);
                          const isToday = isSameDay(day, today);
                          // The band behind the range rounds off where it ends: at the
                          // range's own ends, and at the edges of the week and the month.
                          const bandStarts = position === "start" || weekday === 0 || day.getDate() === 1;
                          const bandEnds = position === "end" || weekday === 6 || day.getDate() === lastDay;
                          const description = describeDay?.(isoDay);

                          return (
                            <span
                              role="gridcell"
                              aria-selected={position !== "outside"}
                              key={isoDay}
                              className={
                                between
                                  ? `bg-accent/15 ${bandStarts ? "rounded-l-tile" : ""} ${bandEnds ? "rounded-r-tile" : ""}`
                                  : undefined
                              }
                            >
                              <button
                                ref={hasFocus ? activeCell : undefined}
                                type="button"
                                // Roving: only the focused day is tabbable, so Tab
                                // leaves the grid instead of walking every day.
                                tabIndex={hasFocus ? 0 : -1}
                                onClick={() => pick(isoDay)}
                                onMouseEnter={() => {
                                  if (anchor) setReach(isoDay);
                                }}
                                onFocus={() => {
                                  if (anchor) setReach(isoDay);
                                }}
                                aria-disabled={pickable ? undefined : true}
                                aria-current={isToday ? "date" : undefined}
                                className={`digits w-full rounded-tile text-center text-sm transition-colors duration-150 ease-signature motion-reduce:transition-none ${renderDayMark ? "py-1" : "py-1.5"} ${
                                  atEnd
                                    ? "bg-accent text-on-accent"
                                    : pickable
                                      ? between
                                        ? "hover:bg-accent/25"
                                        : "hover:bg-raised"
                                      : "cursor-not-allowed text-ink-dim opacity-50"
                                } ${isToday && !atEnd ? "outline-1 outline-ink-dim" : ""}`}
                              >
                                {day.getDate()}
                                {renderDayMark && (
                                  <span aria-hidden className="mt-0.5 flex h-1 justify-center">
                                    {renderDayMark(isoDay, atEnd)}
                                  </span>
                                )}
                                {description && <span className="sr-only">{`: ${description}`}</span>}
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {legend && <div className="mt-3">{legend}</div>}

          <div className="hairline-t mt-3 flex items-center justify-between gap-3 pt-3">
            <p aria-live="polite" className="text-xs text-ink-muted">
              {anchor ? (hints?.end ?? t("pickEnd")) : (hints?.start ?? t("pickStart"))}
            </p>
            <button
              type="button"
              onClick={() => close(true)}
              className="font-display text-xs text-ink-muted transition-colors duration-150 ease-signature hover:text-ink motion-reduce:transition-none"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
