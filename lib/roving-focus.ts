/**
 * Keyboard navigation for composite widgets that use a roving tabindex
 * (radio groups, toolbars, listboxes), following the WAI-ARIA APG patterns.
 *
 * Given the pressed key, the focused index and the item count, returns the
 * index that should receive focus next, or null when the key doesn't navigate
 * (so the caller leaves the event alone). Arrows wrap around the ends.
 */
export function rovingTarget(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;

  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
