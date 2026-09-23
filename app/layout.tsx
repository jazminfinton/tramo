import type { Metadata } from "next";
import { Big_Shoulders, Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { getStoredTheme } from "@/features/theme/queries";
import { brandIconHref } from "@/lib/theme";

import "./globals.css";

// Geist: everything that isn't a poster — nav, buttons, labels, numbers and
// reading. Vercel's typeface for interfaces, in the Swiss tradition: modern
// and technical without a typewriter's slab serifs. Its figures come in a
// tabular set too, for the `digits` utility. Variable, so one file covers
// every weight. next/font self-hosts it at build time.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

// Big Shoulders: the poster voice. Ultra-condensed and heavy, for titles, the
// big numbers and the wordmark. Variable, so its one file covers every weight;
// its optical size axis tightens it further at display sizes.
const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
});

// The favicon is the logo in the person's theme: the tab changes with it.
export async function generateMetadata(): Promise<Metadata> {
  const [t, theme] = await Promise.all([getTranslations("app"), getStoredTheme()]);
  return {
    title: t("name"),
    description: t("description"),
    icons: { icon: { url: brandIconHref(theme), type: "image/svg+xml" } },
  };
}

/**
 * The theme is resolved on the server from cookies and written straight onto
 * <html>, so the first paint is already right: no bootstrap script, no flash.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, theme] = await Promise.all([getLocale(), getStoredTheme()]);

  return (
    <html
      lang={locale}
      data-palette={theme.palette}
      data-theme={theme.mode}
      className={`${geist.variable} ${bigShoulders.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
