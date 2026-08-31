import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/product/product-card";
import { getCategories, queryProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the store by name, type, colour or SKU.",
  // Search result pages carry no unique content worth indexing.
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = q?.trim() ?? "";

  const [result, categories] = await Promise.all([
    term ? queryProducts({ search: term, pageSize: 48 }) : null,
    getCategories(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-3 py-4">
      <h1 className="section-title">Search</h1>

      <form action="/search" method="get" className="mt-3 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={term}
          placeholder="Tees, pants, black, TSHIRT-001…"
          className="field"
          aria-label="Search products"
        />
        <button type="submit" className="btn btn-dark px-4">
          Go
        </button>
      </form>

      {!term ? (
        <section className="mt-6">
          <h2 className="field-label">Browse instead</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link key={c.slug} href={`/shop/${c.slug}`} className="btn btn-ghost px-3 text-xs">
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      ) : result && result.products.length > 0 ? (
        <>
          <p className="my-3 text-xs text-[var(--color-steel)]">
            {result.total} result{result.total === 1 ? "" : "s"} for “{term}”
          </p>
          <div className="product-grid">
            {result.products.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 6} />
            ))}
          </div>
        </>
      ) : (
        <div className="comic-card mt-4 p-5 text-center">
          <p className="display text-lg">No results for “{term}”</p>
          <p className="mt-1.5 text-sm text-[var(--color-graphite)]">
            Try a shorter word, a colour, or a product code.
          </p>
          <Link href="/shop" className="btn btn-primary mt-4 text-sm">
            Shop all
          </Link>
        </div>
      )}
    </div>
  );
}
