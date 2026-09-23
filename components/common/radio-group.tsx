"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { rovingTarget } from "@/lib/roving-focus";

type Option<T extends string> = { value: T; label: string };

type RadioGroupProps<T extends string> = {
  /** Accessible name of the group. */
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  /** Visual content of each option; the button around it is handled here. */
  renderOption: (option: Option<T>, checked: boolean) => ReactNode;
  className?: string;
  optionClassName?: (checked: boolean) => string;
};

/**
 * Custom radio group following the WAI-ARIA APG "Radio Group" pattern. It
 * replaces native radio inputs, which the design system doesn't use.
 *
 * - The group is a single tab stop (roving tabindex on the checked option).
 * - Arrow keys move focus AND select, wrapping at the ends; Home/End jump.
 * - Space selects the focused option (native button behavior).
 */
export function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  renderOption,
  className,
  optionClassName,
}: RadioGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = options.findIndex((option) => option.value === value);
  const tabStop = checkedIndex === -1 ? 0 : checkedIndex;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = rovingTarget(event.key, index, options.length);
    if (target === null) return;

    event.preventDefault();
    const next = options[target];
    if (!next) return;

    onChange(next.value);
    refs.current[target]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((option, index) => {
        const checked = option.value === value;

        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={optionClassName?.(checked)}
          >
            {renderOption(option, checked)}
          </button>
        );
      })}
    </div>
  );
}
