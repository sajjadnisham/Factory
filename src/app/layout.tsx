import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter } from "next/font/google";

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
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
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
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
