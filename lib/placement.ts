export type Box = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };

/**
 * Where a floating panel (a calendar, a list, a tour card) goes next to the
 * element that opened it, in viewport coordinates: below it, or above when it
 * doesn't fit below, left-aligned with it. It never leaves the viewport: when
 * it fits on neither side it's pinned inside, over the anchor.
 */
export function placeNextTo(anchor: Box, panel: Size, viewport: Size, gap = 8, margin = 8) {
  let top = anchor.top + anchor.height + gap;
  let side: "below" | "above" = "below";

  if (top + panel.height > viewport.height - margin) {
    const above = anchor.top - panel.height - gap;
    if (above >= margin) {
      top = above;
      side = "above";
    } else {
      top = Math.max(margin, viewport.height - panel.height - margin);
    }
  }

  const left = Math.max(margin, Math.min(anchor.left, viewport.width - panel.width - margin));
  return { top, left, side };
}

/** Below this width a floating card can't sit next to anything: it docks instead. */
const NARROW = 640;

/**
 * Where a guided-tour card goes. Centered when there's nothing to point at;
 * next to its target on a wide screen; on a phone, docked across the bottom,
 * or across the top when the target is in the lower half, so it never covers
 * what it talks about.
 */
export function placeCard(target: Box | null, card: Size, viewport: Size, margin = 16) {
  if (!target) {
    return { top: (viewport.height - card.height) / 2, left: (viewport.width - card.width) / 2 };
  }
  if (viewport.width < NARROW) {
    const lowerHalf = target.top + target.height / 2 > viewport.height / 2;
    return {
      top: lowerHalf ? margin : viewport.height - card.height - margin,
      left: (viewport.width - card.width) / 2,
    };
  }
  const { top, left } = placeNextTo(target, card, viewport, margin, margin);
  return { top, left };
}
