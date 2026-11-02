import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** Which blocks are on show on the home page: the person's latest ones, or the history. */
export async function EntryTabs({ active }: { active: "recent" | "history" }) {
  const t = await getTranslations("timer");

  return (
    <nav aria-label={t("tabsLabel")} data-tour="entry-tabs" className="flex w-fit gap-1 rounded-tile bg-surface p-1">
      {(["recent", "history"] as const).map((option) => (
        <Link
          key={option}
          href={{ pathname: "/", query: option === "history" ? { tab: "history" } : {} }}
          // The timer stays where it is, right above.
          scroll={false}
          aria-current={active === option ? "page" : undefined}
          className="rounded-[6px] px-3 py-1.5 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:text-ink aria-[current=page]:bg-tile aria-[current=page]:text-ink motion-reduce:transition-none"
        >
          {t(`${option}.title`)}
        </Link>
      ))}
    </nav>
  );
}
