import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

const PAGE_LINK = "inline-flex items-center gap-1.5 rounded-tile px-3 py-1.5 font-display text-sm";

function PageLink({ href, children }: { href: Route | null; children: ReactNode }) {
  if (!href) {
    return (
      <span aria-disabled="true" className={`${PAGE_LINK} text-ink-dim`}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      // A new page of a list stays where the list is.
      scroll={false}
      className={`${PAGE_LINK} bg-raised transition-colors duration-150 ease-signature hover:bg-tile motion-reduce:transition-none`}
    >
      {children}
    </Link>
  );
}

/** Previous and next, for a list paged by cursor. Nothing when it all fits on one page. */
export async function Pagination({ prevHref, nextHref }: { prevHref: Route | null; nextHref: Route | null }) {
  if (!prevHref && !nextHref) return null;
  const t = await getTranslations("pagination");

  return (
    <nav aria-label={t("label")} className="flex items-center justify-between gap-3">
      <PageLink href={prevHref}>
        <ChevronLeft className="icon size-4" aria-hidden />
        {t("previous")}
      </PageLink>
      <PageLink href={nextHref}>
        {t("next")}
        <ChevronRight className="icon size-4" aria-hidden />
      </PageLink>
    </nav>
  );
}
