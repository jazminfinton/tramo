"use client";

import { Menu, X } from "lucide-react";
import type { Route } from "next";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";

import { Logo } from "@/components/global/logo";

export type NavLink = {
  href: Route;
  label: string;
  /** Path prefix of the section's subpages, so they light the link up too. */
  match?: string;
};

// Swipe to close: the drag starts after these pixels (so a tap stays a tap),
// and the sheet closes past this share of its height or above this speed (px/ms).
const DRAG_START = 8;
const CLOSE_SHARE = 0.3;
const CLOSE_SPEED = 0.5;

/**
 * A desktop link's text and its dot: lit for the current page, and pulsing on
 * the link being opened, from the click until the page arrives.
 */
function NavLinkLabel({ label, active }: { label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {label}
      <span
        aria-hidden
        className={`absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent transition-opacity motion-reduce:transition-none ${
          pending ? "animate-pulse opacity-100 motion-reduce:animate-none" : active ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}

type AppNavProps = {
  links: NavLink[];
  workspaceName: string;
  /** The user block (avatar, sign out): inside the pill on desktop, at the sheet's foot on mobile. */
  actions: ReactNode;
};

/**
 * The app's navigation (ported from Fragua's Navbar).
 *
 * Desktop: a floating pill that opens with the logo. A soft highlight slides
 * under the hovered link, the rest dim, and an accent dot marks the current
 * page.
 *
 * Mobile: the links move to a bottom sheet, within thumb reach, set in the
 * poster face. It's a native
 * <dialog>, so focus trapping, Escape and an inert page come free. It closes
 * with the X, by tapping the backdrop, or by swiping down.
 */
export function AppNav({ links, workspaceName, actions }: AppNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const sheetRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startTime: number; offset: number; moved: boolean } | null>(null);
  const [highlight, setHighlight] = useState<{ left: number; width: number } | null>(null);

  const isActive = (link: NavLink) =>
    pathname === link.href || (link.match !== undefined && pathname.startsWith(link.match));

  // The list is the offset parent, so offsetLeft is relative to it.
  function highlightLink(element: HTMLElement) {
    setHighlight({ left: element.offsetLeft, width: element.offsetWidth });
  }

  const closeSheet = () => sheetRef.current?.close();

  function openSheet() {
    // Closing by swipe leaves the panel at the drag offset so it keeps sliding
    // out; clear it before showing the sheet again.
    resetDrag();
    sheetRef.current?.showModal();
    // Focus the panel itself: focusing the X would paint a focus ring on every
    // tap-open. Keyboard users reach the X with Tab.
    panelRef.current?.focus({ preventScroll: true });
  }

  // While dragging, styles are written straight onto the panel, so a finger
  // moving at 120 Hz doesn't re-render React every frame.
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    drag.current = { startY: event.clientY, startTime: event.timeStamp, offset: 0, moved: false };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const panel = panelRef.current;
    if (!state || !panel) return;

    // Down only: the sheet can't be pulled above its resting place.
    const offset = Math.max(0, event.clientY - state.startY);
    if (!state.moved) {
      if (offset < DRAG_START) return;
      state.moved = true;
      // Capturing also redirects the final click to the panel, so a drag that
      // started on a link doesn't follow it.
      try {
        panel.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointers can't be captured; the drag still works.
      }
    }

    state.offset = offset;
    panel.style.transition = "none";
    panel.style.translate = `0 ${offset}px`;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (!state?.moved || !panel) return;

    const speed = state.offset / Math.max(1, event.timeStamp - state.startTime);
    panel.style.transition = "";
    if (state.offset > panel.offsetHeight * CLOSE_SHARE || speed > CLOSE_SPEED) {
      closeSheet(); // keeps the offset while it slides out; openSheet resets it
    } else {
      panel.style.translate = ""; // not far or fast enough: back into place
    }
  }

  function resetDrag() {
    drag.current = null;
    panelRef.current?.style.removeProperty("transition");
    panelRef.current?.style.removeProperty("translate");
  }

  return (
    <header className="sticky top-3 z-40 mx-auto mt-3 w-full max-w-5xl px-3">
      <nav
        aria-label={t("label")}
        className="flex h-14 items-center gap-3 rounded-pill bg-surface/80 pr-2 pl-4 shadow-lg shadow-black/20 backdrop-blur"
      >
        <Link href="/" className="flex-none">
          <Logo name={t("appName")} size="sm" />
        </Link>
        <span className="hidden max-w-40 truncate text-sm text-ink-dim lg:inline">{workspaceName}</span>

        <ul
          className="group/nav relative ml-2 hidden items-center md:flex"
          onMouseLeave={() => setHighlight(null)}
          onBlur={() => setHighlight(null)}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 rounded-pill bg-ink/[0.07] transition-[left,width,opacity] duration-300 ease-signature motion-reduce:transition-none"
            style={{ left: highlight?.left ?? 0, width: highlight?.width ?? 0, opacity: highlight ? 1 : 0 }}
          />
          {links.map((link) => {
            const active = isActive(link);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onMouseEnter={(event) => highlightLink(event.currentTarget)}
                  onFocus={(event) => highlightLink(event.currentTarget)}
                  className={`relative block px-3 py-2 font-display text-sm transition-colors duration-150 ease-signature group-hover/nav:text-ink-dim hover:text-ink! focus-visible:text-ink! motion-reduce:transition-none ${
                    active ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  <NavLinkLabel label={link.label} active={active} />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto hidden items-center gap-1 md:flex">{actions}</div>

        <button
          type="button"
          data-tour="nav-menu"
          onClick={openSheet}
          aria-label={t("openMenu")}
          aria-haspopup="dialog"
          className="ml-auto inline-flex size-10 items-center justify-center rounded-pill text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none md:hidden"
        >
          <Menu className="icon size-5" aria-hidden />
        </button>
      </nav>

      <dialog
        ref={sheetRef}
        aria-label={t("menu")}
        // A click on the dialog element itself is a click on the backdrop.
        onClick={(event) => {
          if (event.target === event.currentTarget) closeSheet();
        }}
        className="mt-auto mb-0 w-full max-w-none translate-y-full bg-transparent p-0 text-ink transition-[translate,display,overlay] transition-discrete duration-300 ease-signature backdrop:bg-ground/60 backdrop:backdrop-blur-[1px] open:translate-y-0 starting:open:translate-y-full motion-reduce:transition-none md:hidden"
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={resetDrag}
          // touch-none hands us vertical drags instead of the browser's scroll
          // and pull-to-refresh.
          className="panel grain rounded-b-none! touch-none px-6 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))] outline-none transition-[translate] duration-300 ease-signature motion-reduce:transition-none"
        >
          <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-ink/20" />
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="truncate font-display text-xs tracking-widest text-ink-dim uppercase">{workspaceName}</span>
            <button
              type="button"
              onClick={closeSheet}
              aria-label={t("closeMenu")}
              className="inline-flex size-10 flex-none items-center justify-center rounded-pill text-ink-muted transition-colors duration-150 ease-signature hover:bg-raised hover:text-ink motion-reduce:transition-none"
            >
              <X className="icon size-5" aria-hidden />
            </button>
          </div>

          <ul className="mt-2">
            {links.map((link, index) => {
              const active = isActive(link);
              return (
                <li
                  key={link.href}
                  // The links rise one after another as the sheet opens.
                  style={{ transitionDelay: `${80 + index * 40}ms` }}
                  className="transition-[opacity,translate] duration-300 starting:translate-y-3 starting:opacity-0 motion-reduce:transition-none"
                >
                  <Link
                    href={link.href}
                    onClick={closeSheet}
                    aria-current={active ? "page" : undefined}
                    className={`poster flex items-center justify-between py-3 text-4xl uppercase transition-colors duration-150 ease-signature hover:text-ink motion-reduce:transition-none ${
                      active ? "text-ink" : "text-ink-muted"
                    }`}
                  >
                    {link.label}
                    {active && <span aria-hidden className="size-2 rounded-full bg-accent" />}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="hairline-t mt-6 flex items-center justify-between gap-3 pt-6">{actions}</div>
        </div>
      </dialog>
    </header>
  );
}
