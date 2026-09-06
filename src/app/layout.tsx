import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter } from "next/font/google";

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

// Archivo Black for headings (bold, urban, fashion-forward); Inter for body
// text, which stays readable at the small sizes a 3-across grid forces.
const display = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-loaded",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body-loaded",
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
    <html lang="en" className={`${display.variable} ${body.variable}`}>
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
        </div>
        {children}
      </body>
    </html>
  );
}
