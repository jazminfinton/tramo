import Link from "next/link";
import { getTranslations } from "next-intl/server";

const ITEMS = [
  { key: "members", href: "/admin/members" },
  { key: "projects", href: "/admin/projects" },
  { key: "workspace", href: "/admin/workspace" },
] as const;

/** Tabs between the admin sections. */
export async function AdminNav({ current }: { current: (typeof ITEMS)[number]["key"] }) {
  const t = await getTranslations("adminNav");

  return (
    <nav aria-label={t("label")} className="flex w-fit gap-1 rounded-tile bg-surface p-1">
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={current === item.key ? "page" : undefined}
          className="rounded-[6px] px-3 py-1.5 font-display text-sm text-ink-muted transition-colors duration-150 ease-signature hover:text-ink aria-[current=page]:bg-tile aria-[current=page]:text-ink motion-reduce:transition-none"
        >
          {t(item.key)}
        </Link>
      ))}
    </nav>
  );
}
