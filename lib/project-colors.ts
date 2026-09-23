/**
 * The closed set of project colors. A project's color is its identity in
 * every chart, so it's stored on the project and never derived from rank or
 * position ("color follows the entity").
 *
 * The ORDER is the colorblind-safety mechanism: adjacent slots were validated
 * for CVD and normal-vision separation (dataviz skill, reference categorical
 * palette), on this app's sixteen surfaces. New projects take slots in this
 * order. The actual values live in app/globals.css (`--color-project-*`),
 * with a stepped set per mode.
 */
export const PROJECT_COLORS = ["blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red"] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number];

export function isProjectColor(value: unknown): value is ProjectColor {
  return typeof value === "string" && (PROJECT_COLORS as readonly string[]).includes(value);
}

/**
 * The color for a new project: the first slot nobody uses, in order; once all
 * eight are taken, the least-used one (earliest in order on ties).
 */
export function nextProjectColor(usedColors: readonly string[]): ProjectColor {
  const counts = new Map<ProjectColor, number>(PROJECT_COLORS.map((color) => [color, 0]));
  for (const color of usedColors) {
    if (isProjectColor(color)) counts.set(color, (counts.get(color) ?? 0) + 1);
  }

  let best: ProjectColor = PROJECT_COLORS[0];
  for (const color of PROJECT_COLORS) {
    if ((counts.get(color) ?? 0) < (counts.get(best) ?? 0)) best = color;
  }
  return best;
}
