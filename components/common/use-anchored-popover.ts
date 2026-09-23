"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

import { placeNextTo } from "@/lib/placement";

type AnchoredPopover = {
  open: boolean;
  /** The element the panel opens next to. */
  anchor: RefObject<HTMLElement | null>;
  /** At least as wide as the anchor, like a select's list. */
  matchWidth?: boolean;
  /** Space between the anchor and the panel, in pixels. */
  gap?: number;
};

/**
 * Opens a panel in the TOP LAYER (Popover API) next to its anchor, so no
 * ancestor can clip it: a modal <dialog> gets `overflow: auto` from the
 * browser and used to cut calendars and lists off. Being fixed-positioned,
 * the panel is placed by hand (lib/placement.ts) and follows the anchor
 * while anything scrolls or the window resizes.
 *
 * Returns the ref for the panel, which must carry `popover="manual"`: manual
 * popovers leave opening, closing, Escape and outside clicks to the
 * component, so Escape in a panel never closes the dialog it lives in.
 */
export function useAnchoredPopover<T extends HTMLElement>({ open, anchor, matchWidth = false, gap = 8 }: AnchoredPopover) {
  const panel = useRef<T>(null);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!open || !element) return;

    function place() {
      const box = anchor.current?.getBoundingClientRect();
      if (!box || !element) return;
      if (matchWidth) element.style.minWidth = `${box.width}px`;
      const size = element.getBoundingClientRect();
      const { top, left } = placeNextTo(box, size, { width: window.innerWidth, height: window.innerHeight }, gap);
      element.style.top = `${top}px`;
      element.style.left = `${left}px`;
    }

    element.showPopover();
    place();
    window.addEventListener("resize", place);
    // Capture: any scrolling container (the dialog itself) moves the anchor.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, matchWidth, gap]);

  return panel;
}
