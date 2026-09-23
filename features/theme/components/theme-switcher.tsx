"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { RadioGroup } from "@/components/common/radio-group";
import { saveTheme } from "@/features/theme/actions";
import { brandIconHref, MODES, PALETTES, type Theme } from "@/lib/theme";

const optionClass = (checked: boolean) =>
  `flex items-center gap-3 rounded-tile px-3 py-2.5 text-left text-sm transition-colors duration-150 ease-signature motion-reduce:transition-none ${
    checked ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised/60 hover:text-ink"
  }`;

/**
 * Palette and mode picker. The change is applied to <html> right away and
 * stored in the background; the server reads the stored value on the next
 * render, so both always agree.
 *
 * Each swatch carries its own `data-palette` / `data-theme`, so it renders in
 * the theme it stands for through the same CSS variables — no colors are
 * duplicated here.
 */
export function ThemeSwitcher({ initial }: { initial: Theme }) {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState(initial);
  const [, startTransition] = useTransition();

  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.palette = next.palette;
    document.documentElement.dataset.theme = next.mode;
    // The tab's icon wears the palette too.
    for (const link of document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']")) {
      link.href = brandIconHref(next);
    }
    startTransition(async () => {
      await saveTheme(next.palette, next.mode);
    });
  }

  const checkMark = (checked: boolean) =>
    checked ? <Check className="icon ml-auto size-4 text-accent" aria-hidden /> : null;

  return (
    <section className="panel grain flex flex-col gap-5 p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <span className="font-display text-xs tracking-widest text-ink-dim uppercase">
          {t("palette")}
        </span>
        <RadioGroup
          label={t("palette")}
          value={theme.palette}
          options={PALETTES.map((palette) => ({ value: palette, label: t(`palettes.${palette}`) }))}
          onChange={(palette) => apply({ ...theme, palette })}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          optionClassName={optionClass}
          renderOption={(option, checked) => (
            <>
              <span
                data-palette={option.value}
                data-theme={theme.mode}
                aria-hidden
                className="flex size-6 flex-none items-center justify-center rounded-full bg-ground"
              >
                <span className="size-3 rounded-full bg-accent" />
              </span>
              <span>{option.label}</span>
              {checkMark(checked)}
            </>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-display text-xs tracking-widest text-ink-dim uppercase">
          {t("mode")}
        </span>
        <RadioGroup
          label={t("mode")}
          value={theme.mode}
          options={MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))}
          onChange={(mode) => apply({ ...theme, mode })}
          className="grid grid-cols-2 gap-2"
          optionClassName={optionClass}
          renderOption={(option, checked) => (
            <>
              <span
                data-palette={theme.palette}
                data-theme={option.value}
                aria-hidden
                className="flex size-6 flex-none items-center justify-center rounded-full bg-surface"
              >
                <span className="size-3 rounded-full bg-ink" />
              </span>
              <span>{option.label}</span>
              {checkMark(checked)}
            </>
          )}
        />
      </div>
    </section>
  );
}
