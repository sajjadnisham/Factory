import Link from "next/link";

import { ProductCard } from "@/components/product/product-card";
import {
  getCategories,
  getFeaturedProducts,
  getNewArrivals,
  getProductsByType,
} from "@/lib/catalog";
import { getSettings } from "@/lib/settings";

// Products change whenever the owner syncs STOCK, so the homepage is rendered
// per request rather than baked at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, categories, newArrivals, featured, tees, pants] =
    await Promise.all([
      getSettings(),
      getCategories(),
      getNewArrivals(9),
      getFeaturedProducts(6),
      getProductsByType("tshirt", 6),
      getProductsByType("pants", 6),
    ]);

  const empty = newArrivals.length === 0 && featured.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* --- Hero ---------------------------------------------------------- */}
      {/*
        The eclipse is the hero, and the words sit under it rather than over it.
        Laying type across the middle of a chromatic ring means the headline
        crosses six hues and is legible against none of them; below the form,
        on the near-black ground, it needs no scrim and the ring stays whole.
      */}
      <section className="relative overflow-hidden px-5 pb-9 pt-4 text-[var(--color-on-slab)]">
        <div className="relative mx-auto flex aspect-square w-full max-w-[22rem] items-center justify-center">
          <div className="eclipse inset-0" aria-hidden />
          <span className="relative text-center font-[family-name:var(--font-body)] text-[0.65rem] uppercase tracking-[0.34em] text-[var(--color-mist)]">
            {settings.tagline}
          </span>
        </div>

        <h1 className="mt-2 text-[2.6rem] leading-[0.92] tracking-tight text-[var(--color-on-slab)] md:text-6xl">
          {settings.heroHeadline}
        </h1>
        <p className="mt-3 max-w-md text-sm text-[var(--color-mist)] md:text-base">
          {settings.heroSubline}
        </p>
        <Link href="/shop" className="btn btn-primary mt-6 text-sm">
          {settings.heroCtaLabel}
        </Link>
      </section>

      {empty ? (
        <section className="p-4">
          <div className="comic-card p-5">
            <h2 className="section-title">No products yet</h2>
            <p className="mt-2 text-sm text-[var(--color-graphite)]">
              The catalogue is empty because the STOCK folder has not been synced
              yet. Add product folders to STOCK, then run{" "}
              <code className="rounded bg-[var(--color-paper)] px-1">SYNC STOCK</code>{" "}
              from the admin dashboard.
            </p>
            <Link href="/admin" className="btn btn-dark mt-4 text-sm">
              Go to admin
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* --- Categories ------------------------------------------------ */}
          {categories.length > 0 && (
            <section className="px-5 py-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/shop/${category.slug}`}
                    className="comic-card flex items-center justify-between px-3.5 py-3"
                  >
                    <span className="text-[0.8rem] font-semibold uppercase tracking-[0.12em]">
                      {category.name}
                    </span>
                    <span className="text-xs text-[var(--color-steel)]">
                      {category.count}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <ProductRail title="New arrivals" href="/shop?sort=newest" products={newArrivals} priority />
          <ProductRail title="Featured" href="/shop?sort=featured" products={featured} />
          <ProductRail title="T-Shirts" href="/shop/t-shirts" products={tees} />
          <ProductRail title="Pants" href="/shop/pants" products={pants} />
        </>
      )}

      {/* --- Brand message ------------------------------------------------- */}
      <section className="iris-wash relative mx-5 my-7 overflow-hidden rounded-[26px] border border-[color-mix(in_srgb,var(--color-ink)_14%,transparent)] p-6">
        <h2 className="section-title">{settings.storeName}</h2>
        <p className="mt-2 max-w-sm text-sm text-[var(--color-ink)]">{settings.brandMessage}</p>
        <p className="mt-4 text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-volt)]">
          {settings.deliveryHeadline}
        </p>
        <p className="mt-1.5 text-[0.7rem] text-[var(--color-mist)]">
          {settings.deliveryAreas.join(" · ")}
        </p>
      </section>
    </div>
  );
}

function ProductRail({
  title,
  href,
  products,
  priority = false,
}: {
  title: string;
  href: string;
  products: Awaited<ReturnType<typeof getNewArrivals>>;
  priority?: boolean;
}) {
  if (products.length === 0) return null;

  return (
    <section className="px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="section-title">{title}</h2>
        <Link
          href={href}
          className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--color-steel)]"
        >
          See all
        </Link>
      </div>
      <div className="rail">
        {products.map((product, i) => (
          <ProductCard
            key={product.id}
            product={product}
            priority={priority && i < 2}
            sizes="(max-width: 639px) 84vw, (max-width: 1023px) 46vw, 30vw"
          />
        ))}
      </div>
    </section>
  );
}
