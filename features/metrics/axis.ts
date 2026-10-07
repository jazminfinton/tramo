/** How many names fit along the chart's axis before they'd run into each other. */
const AXIS_ROOM = 12;

/**
 * How far apart the named columns are on the axis: every column while they
 * fit, and past that every second, every third... evenly, from the first one.
 * The rest keep their name in the tooltip and in the table.
 */
export function namedEvery(columns: number): number {
  return Math.max(1, Math.ceil(columns / AXIS_ROOM));
}
