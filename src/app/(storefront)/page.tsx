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
      <section className="relative overflow-hidden border-b-[2.5px] border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-10 text-[var(--color-paper)] md:py-16">
        <div className="stripes absolute -right-8 -top-8 h-40 w-40 opacity-20" aria-hidden />
        <div className="relative">
          <span className="sticker sticker-new">{settings.tagline}</span>
          <h1 className="mt-3 max-w-lg text-4xl leading-[0.95] text-[var(--color-white)] md:text-6xl">
            {settings.heroHeadline}
          </h1>
          <p className="mt-3 max-w-md text-sm text-[var(--color-mist)] md:text-base">
            {settings.heroSubline}
          </p>
          <Link href="/shop" className="btn btn-primary mt-5 text-base">
            {settings.heroCtaLabel}
          </Link>
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
            <section className="px-4 py-5">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/shop/${category.slug}`}
                    className="comic-card flex items-center justify-between p-3"
                  >
                    <span className="text-sm font-semibold uppercase tracking-wide">
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
      <section className="mx-4 my-6 border-[2.5px] border-[var(--color-ink)] bg-[var(--color-volt)] p-5 shadow-[6px_6px_0_var(--color-ink)]">
        <h2 className="section-title">{settings.storeName}</h2>
        <p className="mt-2 text-sm font-medium">{settings.brandMessage}</p>
        <p className="mt-3 text-xs font-bold uppercase">{settings.deliveryHeadline}</p>
        <p className="mt-1 text-xs font-semibold">
          {settings.deliveryAreas.join(" • ")}
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
    <section className="px-4 py-4">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="section-title">{title}</h2>
        <Link href={href} className="text-xs font-bold uppercase underline">
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
