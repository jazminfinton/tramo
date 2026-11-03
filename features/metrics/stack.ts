/** The surface gap between two fills of a bar. */
export const GAP = 2;

/** The smallest piece worth drawing: a sliver still says there's some. */
const MIN_PIECE = 1;

export type Piece = { y: number; height: number };

/**
 * How a segment of a bar splits by what's paid: the solid piece at the bottom,
 * the light one with what's left on top, and the gap between them. A segment too
 * thin for two pieces and a gap takes the tone of most of it.
 */
export function paidPieces(segment: Piece, share: number): { solid: Piece | null; light: Piece | null } {
  if (share <= 0) return { solid: null, light: segment };
  if (share >= 1) return { solid: segment, light: null };

  const room = segment.height - GAP;
  if (room < MIN_PIECE * 2) return share < 0.5 ? { solid: null, light: segment } : { solid: segment, light: null };

  const solid = Math.min(Math.max(segment.height * share, MIN_PIECE), room - MIN_PIECE);
  return {
    solid: { y: segment.y + segment.height - solid, height: solid },
    light: { y: segment.y, height: room - solid },
  };
}
