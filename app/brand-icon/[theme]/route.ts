import { brandIconSvg } from "@/lib/brand-icon";
import { isMode, isPalette, MODES, PALETTES, THEME_ACCENTS } from "@/lib/theme";

// The favicon, one per theme (`lima-dark`, `salvia-light`…), so the tab wears
// the person's palette. Every palette and mode is drawn at build time;
// anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return PALETTES.flatMap((palette) => MODES.map((mode) => ({ theme: `${palette}-${mode}` })));
}

export async function GET(_request: Request, { params }: RouteContext<"/brand-icon/[theme]">) {
  const { theme } = await params;
  const [palette, mode] = theme.split("-");
  if (!isPalette(palette) || !isMode(mode)) return new Response(null, { status: 404 });

  const { accent, onAccent } = THEME_ACCENTS[palette][mode];
  return new Response(brandIconSvg({ background: accent, foreground: onAccent }), {
    headers: {
      "Content-Type": "image/svg+xml",
      // A theme's icon never changes: its URL names the theme.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
