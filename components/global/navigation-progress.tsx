"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { startsNavigation } from "@/lib/navigation";

/** What programmatic navigations (router.push) dispatch, so the bar starts at the click too. */
const NAVIGATION_START = "horas:navigation-start";

/** Call right before router.push/replace, so the progress bar starts at the click. */
export function announceNavigation() {
  window.dispatchEvent(new Event(NAVIGATION_START));
}

const currentUrl = (pathname: string, search: string) => `${pathname}?${new URLSearchParams(search).toString()}`;

// Whether a click opens another page of this app in this tab.
function isNavigation(event: MouseEvent) {
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  return startsNavigation(
    { href: anchor.href, target: anchor.target, download: anchor.hasAttribute("download") },
    { button: event.button, modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey },
    location.href,
  );
}

/**
 * A thin accent bar across the top of the window, from the moment a link is
 * clicked until the next page is on screen. Pages render on the server, so
 * they take a round trip to arrive: without it, a click looks ignored.
 *
 * It starts on clicks on internal links (and on announceNavigation), grows
 * fast and then slower and slower, and completes and fades out when the URL
 * changes. Screen readers hear "Cargando…".
 */
export function NavigationProgress() {
  const t = useTranslations("nav");
  const url = currentUrl(usePathname(), useSearchParams().toString());
  // The URL the navigation started from: while it's still on screen, it's loading.
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    let giveUp: number | undefined;
    function start() {
      setFrom(currentUrl(location.pathname, location.search));
      // A navigation that never lands (an error, a redirect back here) can't leave it stuck.
      window.clearTimeout(giveUp);
      giveUp = window.setTimeout(() => setFrom(null), 15_000);
    }
    // Capture phase: <Link> cancels the click's default action before it bubbles up.
    const onClick = (event: MouseEvent) => {
      if (isNavigation(event)) start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(NAVIGATION_START, start);
    return () => {
      window.clearTimeout(giveUp);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAVIGATION_START, start);
    };
  }, []);

  const loading = from !== null && from === url;
  const finishing = from !== null && from !== url;

  // Once the new page is up, the bar completes, fades, and resets.
  useEffect(() => {
    if (!finishing) return;
    const id = window.setTimeout(() => setFrom(null), 400);
    return () => window.clearTimeout(id);
  }, [finishing]);

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
        <div
          className={`h-full origin-left bg-accent motion-reduce:transition-none ${
            loading
              ? "scale-x-[0.85] transition-transform duration-[8s] ease-out"
              : finishing
                ? "scale-x-100 opacity-0 transition-[scale,opacity] duration-300 ease-signature"
                : "scale-x-0 opacity-0"
          }`}
        />
      </div>
      <p role="status" className="sr-only">
        {loading ? t("loading") : ""}
      </p>
    </>
  );
}
