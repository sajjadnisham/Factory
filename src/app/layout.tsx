import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter } from "next/font/google";

import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCart } from "@/lib/cart";
import { getCategories } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";

import "./globals.css";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, categories, cart] = await Promise.all([
    getSettings(),
    getCategories(),
    getCart(),
  ]);

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-[var(--color-volt)] focus:px-3 focus:py-2"
        >
          Skip to content
        </a>

        <SiteHeader
          storeName={settings.logoText}
          categories={categories}
          cartCount={cart.itemCount}
          promoMessage={settings.promoMessage}
        />

        {/* Bottom padding clears the fixed mobile nav. */}
        <main id="main" className="pb-24 md:pb-8">
          {children}
        </main>

        <SiteFooter settings={settings} categories={categories} />
        <BottomNav cartCount={cart.itemCount} />
      </body>
    </html>
  );
}
