import { clockParts } from "@/features/time/timer-state";

export type ClockState = "idle" | "running" | "paused";

type ClockTilesProps = {
  ms: number;
  state: ClockState;
  /** Accessible name of the clock ("Tiempo transcurrido"). */
  label: string;
  units: { hours: string; minutes: string; seconds: string };
  /** Sizes everything: the tiles, gaps and unit names are all in em. */
  className?: string;
  /** For the unit names, e.g. to hide them in a tiny window. */
  unitClassName?: string;
};

// Solid accent while running, a soft accent tint while paused, quiet when idle.
const TILE: Record<ClockState, string> = {
  running: "bg-accent text-on-accent",
  paused: "bg-accent/15 text-accent",
  idle: "bg-tile text-ink",
};

/**
 * The clock as three blocks, hours, minutes and seconds, each named below:
 * the poster face in rounded tiles of the theme's accent. The poster face has
 * no tabular figures, so every digit gets its own 1ch cell and nothing jumps
 * as the seconds tick.
 *
 * The digits are stretched to 125% of their height, poster-style. A scale
 * doesn't move layout, so the tile's padding makes the room: the stretched
 * ink overflows the 0.85em line box by 0.1em on top and 0.075em below, and
 * each side keeps about 0.09em of breathing room past that.
 */
export function ClockTiles({ ms, state, label, units, className = "text-7xl", unitClassName = "" }: ClockTilesProps) {
  const parts = clockParts(ms);
  const blocks = [
    ["hours", parts.hours],
    ["minutes", parts.minutes],
    ["seconds", parts.seconds],
  ] as const;

  return (
    <div role="timer" aria-label={`${label}: ${parts.hours}:${parts.minutes}:${parts.seconds}`} className={`flex gap-[0.12em] ${className}`}>
      {blocks.map(([unit, value]) => (
        <div key={unit} aria-hidden className="flex flex-col items-center gap-[0.1em]">
          <span className={`poster flex rounded-[0.1em] px-[0.12em] pt-[0.19em] pb-[0.165em] ${TILE[state]}`}>
            {value.split("").map((digit, index) => (
              <span key={index} className="inline-block w-[1ch] scale-y-125 text-center">
                {digit}
              </span>
            ))}
          </span>
          <span className={`font-display text-[max(9px,0.14em)] tracking-widest text-ink-dim uppercase ${unitClassName}`}>
            {units[unit]}
          </span>
        </div>
      ))}
    </div>
  );
}
