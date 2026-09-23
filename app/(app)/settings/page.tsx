import { getTranslations } from "next-intl/server";

import { ThemeSwitcher } from "@/features/theme/components/theme-switcher";
import { getStoredTheme } from "@/features/theme/queries";
import { requireMember } from "@/lib/dal";

export default async function SettingsPage() {
  await requireMember();
  const [t, theme] = await Promise.all([getTranslations("settings"), getStoredTheme()]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="poster text-6xl uppercase sm:text-7xl">{t("title")}</h1>
        <p className="text-sm text-ink-muted">{t("themeHint")}</p>
      </header>
      <div data-tour="theme-picker">
        <ThemeSwitcher initial={theme} />
      </div>
    </main>
  );
}
