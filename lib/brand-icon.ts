/**
 * Tramo's mark as a standalone SVG, for places React doesn't render: the
 * favicon. It's the same drawing as the header's logo
 * (components/global/logo.tsx): a hexagon in the theme's accent with
 * Lucide's hourglass inside (paths from Lucide, ISC license).
 *
 * The hexagon is Fragua's badge, so the two marks read as one family: a
 * regular pointy-top hexagon with circular corner fillets of r = 0.32 R,
 * drawn in a viewBox that is the rounded shape's exact bounds. The CSS mask of
 * `logo-badge` (app/globals.css) uses this same path; a test keeps them equal.
 */

export const HEXAGON_VIEWBOX = { width: 86.6, height: 95.05 };
export const HEXAGON_PATH =
  "M35.30 2.14A16 16 0 0 1 51.30 2.14L78.60 17.91A16 16 0 0 1 86.60 31.76L86.60 63.29A16 16 0 0 1 78.60 77.14L51.30 92.91A16 16 0 0 1 35.30 92.91L8.00 77.14A16 16 0 0 1 -0.00 63.29L0.00 31.76A16 16 0 0 1 8.00 17.91Z";

/** The hourglass's box, as a share of the hexagon's height (Lucide's 24-unit grid inside it). */
export const HOURGLASS_BOX = 0.55;
/** Its stroke on Lucide's grid: heavier than an icon's, since it's a mark. */
export const HOURGLASS_STROKE = 2.75;

const HOURGLASS = [
  "M5 22h14",
  "M5 2h14",
  "M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22",
  "M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2",
];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SIZE = 32;
/** The hexagon's height in the icon; the rest is breathing room, as in Fragua's icons. */
const HEX_HEIGHT = 0.92;

export function brandIconSvg({ background, foreground }: { background: string; foreground: string }): string {
  if (!HEX_COLOR.test(background) || !HEX_COLOR.test(foreground)) {
    throw new Error("brandIconSvg takes #rrggbb colors only");
  }

  const hexHeight = SIZE * HEX_HEIGHT;
  const hexScale = hexHeight / HEXAGON_VIEWBOX.height;
  const hexWidth = HEXAGON_VIEWBOX.width * hexScale;
  const box = hexHeight * HOURGLASS_BOX; // the hourglass's 24-unit box, centered
  const glass = box / 24;
  const at = (value: number) => value.toFixed(3);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">`,
    `<path d="${HEXAGON_PATH}" fill="${background}" transform="translate(${at((SIZE - hexWidth) / 2)} ${at((SIZE - hexHeight) / 2)}) scale(${at(hexScale)})"/>`,
    `<g transform="translate(${at((SIZE - box) / 2)} ${at((SIZE - box) / 2)}) scale(${at(glass)})" fill="none" stroke="${foreground}" stroke-width="${HOURGLASS_STROKE}" stroke-linecap="round" stroke-linejoin="round">`,
    ...HOURGLASS.map((d) => `<path d="${d}"/>`),
    `</g>`,
    `</svg>`,
  ].join("");
}
