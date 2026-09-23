import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Reads the request config from ./i18n/request.ts (single locale, no routing).
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Type-checks every `href` against the real route tree.
  typedRoutes: true,
  devIndicators: { position: "bottom-right" },
  experimental: {
    // `next build` starts one worker per CPU minus one, and on machines with
    // little free memory they crash while collecting page data. Two are enough
    // locally; Vercel builds keep Next's default.
    cpus: process.env.VERCEL ? undefined : 2,
  },
};

export default withNextIntl(nextConfig);
