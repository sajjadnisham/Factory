import type { Metadata, Viewport } from "next";
import { Anton, Archivo_Black, Manrope } from "next/font/google";

import { FluidCanvas } from "@/components/layout/fluid-canvas";
import { appUrl } from "@/lib/env";
import { getSettings } from "@/lib/settings";

import "./globals.css";

/**
 * Root shell only: fonts, global CSS and document metadata.
 *
 * Store chrome (header, footer, bottom nav) lives in the (storefront) route
 * group instead, so the admin area does not render customer navigation — and
 * does not pay for the cart and category queries that chrome needs.
 */

/*
 * Three faces, each with one job.
 *
 * Anton for headings: a tall condensed grotesque with the proportions of a
 * fly-poster, which is the right register for streetwear and holds its shape at
 * the small sizes a product grid forces. It also carries a dark ground well —
 * its strokes are thick enough that they do not bloom and thin out the way a
 * lighter face does against near-black.
 *
 * Manrope for body copy, set a weight up from the usual: on a dark background
 * type optically thins, so 500 reads here the way 400 reads on white. Its wide
 * apertures and tall x-height are what keep a size run legible at 10px.
 *
 * Archivo Black stays, but only for the wordmark. The logo is a wide varsity
 * block and Anton is condensed; sharing one face between them would have made
 * the mark something it is not.
 */
const display = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-loaded",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body-loaded",
  display: "swap",
});

const logo = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-logo-loaded",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    metadataBase: new URL(appUrl()),
    title: {
      default: `${settings.storeName} — ${settings.tagline}`,
      template: `%s | ${settings.storeName}`,
    },
    description: settings.brandMessage,
    openGraph: {
      type: "website",
      siteName: settings.storeName,
      title: `${settings.storeName} — ${settings.tagline}`,
      description: settings.brandMessage,
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0b0b0f",
  // Tells the browser the page is dark, so form controls, scrollbars and the
  // address bar are rendered to match rather than as light widgets on a dark
  // page.
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${logo.variable}`}>
      <body className="min-h-dvh">
        {/*
          One fixed layer behind every page — storefront and admin alike —
          rather than a per-page background. Mounting it in the root layout
          means it is painted once and never re-created on navigation, so the
          drift carries across route changes instead of restarting.
        */}
        <div className="fluid" aria-hidden="true">
          <span className="f1" />
          <span className="f2" />
          <span className="f3" />
          {/* The gradients above are painted server-side and are what a visitor
              sees before JS runs, with no WebGL, or under reduced motion. The
              canvas is the moving version of the same field, layered over. */}
          <FluidCanvas />
        </div>
        {children}
      </body>
    </html>
  );
}
