import Link from "next/link";

import type { StoreSettings } from "@/lib/settings";

interface Props {
  settings: StoreSettings;
  categories: { slug: string; name: string }[];
}

export function SiteFooter({ settings, categories }: Props) {
  return (
    <footer className="border-t-[2.5px] border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="display text-2xl text-[var(--color-volt)]">{settings.logoText}</p>
        <p className="mt-2 max-w-md text-sm text-[var(--color-mist)]">
          {settings.brandMessage}
        </p>

        <div className="mt-7 grid gap-7 sm:grid-cols-3">
          <div>
            <h2 className="text-xs tracking-widest text-[var(--color-volt)]">Shop</h2>
            <ul className="mt-2.5 space-y-1.5 text-sm">
              <li>
                <Link href="/shop" className="hover:text-[var(--color-volt)]">
                  All products
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/shop/${c.slug}`} className="hover:text-[var(--color-volt)]">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs tracking-widest text-[var(--color-volt)]">Help</h2>
            <ul className="mt-2.5 space-y-1.5 text-sm">
              <li><Link href="/account/orders" className="hover:text-[var(--color-volt)]">Track my order</Link></li>
              <li><Link href="/pages/shipping" className="hover:text-[var(--color-volt)]">Delivery</Link></li>
              <li><Link href="/pages/returns" className="hover:text-[var(--color-volt)]">Returns &amp; refunds</Link></li>
              <li><Link href="/pages/contact" className="hover:text-[var(--color-volt)]">Contact us</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs tracking-widest text-[var(--color-volt)]">Legal</h2>
            <ul className="mt-2.5 space-y-1.5 text-sm">
              <li><Link href="/pages/privacy" className="hover:text-[var(--color-volt)]">Privacy policy</Link></li>
              <li><Link href="/pages/terms" className="hover:text-[var(--color-volt)]">Terms &amp; conditions</Link></li>
            </ul>

            {/* Only rendered once the owner has supplied real details — the app
                never invents business contact information. */}
            {(settings.contactPhone || settings.contactEmail) && (
              <ul className="mt-3.5 space-y-1.5 text-sm text-[var(--color-mist)]">
                {settings.contactPhone && <li>{settings.contactPhone}</li>}
                {settings.contactEmail && <li>{settings.contactEmail}</li>}
              </ul>
            )}
          </div>
        </div>

        <p className="mt-8 border-t border-[var(--color-graphite)] pt-4 text-xs text-[var(--color-steel)]">
          © {new Date().getFullYear()} {settings.storeName}. Prices in MVR.
        </p>
      </div>
    </footer>
  );
}
