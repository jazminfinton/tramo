import { Hourglass } from "lucide-react";

import { HOURGLASS_BOX, HOURGLASS_STROKE } from "@/lib/brand-icon";

/**
 * Tramo's mark: Lucide's hourglass inside a hexagon of the theme's accent,
 * so it changes with the palette. The hexagon is Fragua's badge (the
 * `logo-badge` utility), so both marks read as one family. The favicon draws
 * the same thing (lib/brand-icon.ts): change one, change the other.
 *
 * The hourglass takes the color that reads on the accent (`on-accent`): white
 * would all but vanish on a light accent like Lima's. It's a drawing, not a UI
 * icon, so it sets its own, heavier stroke instead of the `icon` class.
 */
export function LogoMark({ className = "h-10" }: { className?: string }) {
  return (
    <span aria-hidden className={`logo-badge flex-none text-accent ${className}`}>
      <Hourglass
        className="aspect-square w-auto text-on-accent"
        style={{ height: `${HOURGLASS_BOX * 100}%` }}
        strokeWidth={HOURGLASS_STROKE}
      />
    </span>
  );
}

const SIZES = {
  sm: { mark: "h-8", name: "text-2xl", gap: "gap-2" },
  lg: { mark: "h-16", name: "text-6xl", gap: "gap-3" },
};

/** The mark and the name, set in the poster face: small in the nav, large on sign-in. */
export function Logo({ name, size }: { name: string; size: keyof typeof SIZES }) {
  const { mark, name: nameSize, gap } = SIZES[size];
  return (
    <span className={`inline-flex items-center ${gap}`}>
      <LogoMark className={mark} />
      <span className={`poster uppercase ${nameSize}`}>{name}</span>
    </span>
  );
}
