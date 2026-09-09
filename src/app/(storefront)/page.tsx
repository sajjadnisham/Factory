import Link from "next/link";

import { FactoryBadge } from "@/components/brand/factory-badge";
import { ProductCard } from "@/components/product/product-card";
import {
  getCategories,
  getFeaturedProducts,
  getNewArrivals,
  getProductsByType,
} from "@/lib/catalog";
import { getBrandAssets } from "@/lib/brand";
import { getSettings } from "@/lib/settings";

// Products change whenever the owner syncs STOCK, so the homepage is rendered
// per request rather than baked at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, brand, categories, newArrivals, featured, tees, pants] =
    await Promise.all([
      getSettings(),
      getBrandAssets(),
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
      {/*
        Full-bleed, the way the reference frames it: the gradient runs edge to
        edge and past them, with a small two-line label set into the top-left
        corner rather than a headline laid across the middle. Type over the
        centre of a chromatic ring crosses six hues and is legible against none
        of them; type in the corner sits on near-black and needs no scrim.
      */}
      <section className="relative overflow-hidden text-[var(--color-on-slab)]">
        <div className="relative aspect-[4/5] w-full sm:aspect-[16/10]">
          {/* Wider than the screen and pushed up, so the ring is cropped by the
              frame instead of floating inside it. */}
          <div
            className="eclipse left-1/2 top-[34%] h-[118vw] w-[118vw] -translate-x-1/2 -translate-y-1/2 sm:h-[58vw] sm:w-[58vw]"
            aria-hidden
          />

          {/* The badge sits in the hole the ring already leaves. That space is
              circular and near-black by construction, which is exactly what a
              stamped roundel wants behind it — no scrim, no plate, and the ring
              reads as a halo around the mark rather than as decoration beside
              it. Sized and offset to match the ring's centre, not the frame's. */}
          <div className="pointer-events-none absolute left-1/2 top-[34%] w-[38vw] max-w-[9.5rem] -translate-x-1/2 -translate-y-1/2 sm:w-[16vw]">
            {brand.badge ? (
              /* eslint-disable-next-line @next/next/no-img-element -- unknown
                 intrinsic size, served from our own route. */
              <img
                src={`/api/brand/badge?v=${brand.badge.checksum.slice(0, 12)}`}
                alt=""
                className="h-auto w-full"
              />
            ) : (
              <FactoryBadge className="h-auto w-full" />
            )}
          </div>

          {/* The ring is lifted into the upper two-thirds and this scrim seals
              the bottom, so the headline lands on near-black instead of
              crossing four hues. Without one or the other, white type sits on
              cyan and amber at once and reads against neither. */}
          <div
            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--color-paper)] via-[color-mix(in_srgb,var(--color-paper)_72%,transparent)] to-transparent"
            aria-hidden
          />

          <div className="relative flex h-full flex-col justify-between p-5">
            <p className="max-w-[15rem] text-[0.7rem] leading-relaxed text-[var(--color-mist)]">
              {settings.tagline}
              <br />
              {settings.heroSubline}
            </p>

            <div>
              <h1 className="text-[2.4rem] leading-[0.9] tracking-tight text-[var(--color-on-slab)] sm:text-5xl">
                {settings.heroHeadline}
              </h1>
              <Link href="/shop" className="btn btn-primary mt-5 text-sm">
                {settings.heroCtaLabel}
              </Link>
            </div>
          </div>
        </div>
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
