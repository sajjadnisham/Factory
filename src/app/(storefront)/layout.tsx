import { BottomNav } from "@/components/layout/bottom-nav";
import { DemoBanner } from "@/components/layout/demo-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCart } from "@/lib/cart";
import { getCategories } from "@/lib/catalog";
import { getBrandAssets } from "@/lib/brand";
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
  const [settings, categories, cart, brand] = await Promise.all([
    getSettings(),
    getCategories(),
    getCart(),
    getBrandAssets(),
  ]);

  // The checksum in the query string is what makes a replaced logo appear
  // immediately rather than after the browser's cache expires.
  const logoUrl = brand.logo
    ? `/api/brand/logo?v=${brand.logo.checksum.slice(0, 12)}`
    : null;

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-[var(--color-volt)] focus:px-3 focus:py-2 focus:text-[var(--color-slab)]"
      >
        Skip to content
      </a>

      <DemoBanner />

      <SiteHeader
        logoUrl={logoUrl}
        storeName={settings.logoText}
        categories={categories}
        cartCount={cart.itemCount}
        promoMessage={settings.promoMessage}
      />

      <main id="main">{children}</main>

      {/* The fixed mobile nav is cleared here, at the very bottom of the page.
          Putting this padding on <main> instead opened a dead band between the
          last section and the footer — and still left the footer's final line
          sitting under the nav. */}
      <div className="pb-20 md:pb-0">
        <SiteFooter settings={settings} categories={categories} logoUrl={logoUrl} />
      </div>
      <BottomNav cartCount={cart.itemCount} />
    </>
  );
}
