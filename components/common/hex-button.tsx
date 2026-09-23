import type { ButtonHTMLAttributes } from "react";

import { HEXAGON_PATH, HEXAGON_VIEWBOX } from "@/lib/brand-icon";

const { width: W, height: H } = HEXAGON_VIEWBOX;

// The focus ring: the same hexagon grown around its center, so it keeps a gap
// from the shape the way `outline-offset` does for a box.
const RING = `translate(${W / 2} ${H / 2}) scale(1.14) translate(${-W / 2} ${-H / 2})`;

// What paints the hexagon, and what the icon on top wears.
const TONES = {
  accent: { hex: "text-accent", content: "text-on-accent" },
  tile: { hex: "text-tile", content: "text-ink" },
  ghost: {
    hex: "text-transparent group-hover:text-raised group-aria-pressed:text-raised",
    content: "text-ink-muted hover:text-ink aria-pressed:text-accent",
  },
} as const;

type HexButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  tone: keyof typeof TONES;
};

/**
 * A button in the logo's shape: the rounded hexagon, for the actions that
 * carry the brand (the timer's). Give it a square size, like `size-16`: the
 * hexagon fits the square's height and the whole square takes the click.
 *
 * The hexagon is drawn, not masked, because a mask would clip the focus ring
 * too. The ring is a second hexagon around the first, shown on keyboard focus.
 */
export function HexButton({ tone, className = "", children, ...props }: HexButtonProps) {
  const { hex, content } = TONES[tone];

  return (
    <button
      type="button"
      {...props}
      className={`group relative isolate flex flex-none items-center justify-center outline-none transition-[scale,opacity,color] duration-150 ease-signature hover:scale-105 aria-disabled:cursor-wait aria-disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:scale-100 ${content} ${className}`}
    >
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 -z-10 size-full overflow-visible">
        <path
          d={HEXAGON_PATH}
          fill="currentColor"
          className={`transition-colors duration-150 ease-signature motion-reduce:transition-none ${hex}`}
        />
        <path
          d={HEXAGON_PATH}
          transform={RING}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          className="text-accent opacity-0 group-focus-visible:opacity-100"
        />
      </svg>
      {children}
    </button>
  );
}
