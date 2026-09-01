import { BottomNav } from "@/components/layout/bottom-nav";
import { DemoBanner } from "@/components/layout/demo-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCart } from "@/lib/cart";
import { getCategories } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";

/**
 * Customer-facing chrome. A route group, so it wraps every shop page without
 * appearing in any URL — and without wrapping /admin.
 */
export default async function StorefrontLayout({
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
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-[var(--color-volt)] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <DemoBanner />

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
    </>
  );
}
