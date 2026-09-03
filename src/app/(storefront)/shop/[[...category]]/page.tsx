import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/product/product-card";
import { ProductFilters } from "@/components/shop/product-filters";
import { getCategories, getFilterOptions, queryProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Optional catch-all: /shop and /shop/t-shirts share this page. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category?: string[] }>;
}): Promise<Metadata> {
  const { category } = await params;
  const slug = category?.[0];
  if (!slug) {
    return {
      title: "Shop all",
      description: "Every product in the store — tees, pants and more.",
      alternates: { canonical: "/shop" },
    };
  }

  const categories = await getCategories();
  const match = categories.find((c) => c.slug === slug);
  return {
    title: match?.name ?? "Shop",
    description: `Shop ${match?.name ?? slug} — ${match?.count ?? 0} products.`,
    alternates: { canonical: `/shop/${slug}` },
  };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ category?: string[] }>;
  searchParams: SearchParams;
}) {
  const [{ category }, query] = await Promise.all([params, searchParams]);
  const slug = category?.[0];

  if (category && category.length > 1) notFound();

  const categories = await getCategories();
  if (slug && !categories.some((c) => c.slug === slug)) notFound();

  const page = Number.parseInt(single(query.page) ?? "1", 10) || 1;
  const [result, options] = await Promise.all([
    queryProducts({
      categorySlug: slug,
      colors: many(query.color),
      sizes: many(query.size),
      maxPriceMinor: query.max_price ? Number(single(query.max_price)) : undefined,
      inStockOnly: single(query.in_stock) === "1",
      sort: (single(query.sort) as "newest" | undefined) ?? "newest",
      page,
      pageSize: 24,
    }),
    getFilterOptions(),
  ]);

  const basePath = slug ? `/shop/${slug}` : "/shop";
  const title = slug
    ? (categories.find((c) => c.slug === slug)?.name ?? "Shop")
    : "All products";

  return (
    <div className="mx-auto max-w-6xl px-3 py-4">
      <h1 className="section-title mb-1">{title}</h1>
      <p className="mb-3 text-xs text-[var(--color-steel)]">
        {result.total} product{result.total === 1 ? "" : "s"}
      </p>

      <div className="chip-row mb-3">
        <Link
          href="/shop"
          className={`btn btn-chip shrink-0 px-3 text-xs ${!slug ? "btn-dark" : "btn-ghost"}`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/shop/${c.slug}`}
            className={`btn btn-chip shrink-0 px-3 text-xs ${
              slug === c.slug ? "btn-dark" : "btn-ghost"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <ProductFilters options={options} basePath={basePath} />

      {result.products.length === 0 ? (
        <div className="comic-card p-5 text-center">
          <p className="display text-lg">Nothing matches</p>
          <p className="mt-1.5 text-sm text-[var(--color-graphite)]">
            Try clearing a filter or browsing another category.
          </p>
          <Link href="/shop" className="btn btn-primary mt-4 text-sm">
            Shop all
          </Link>
        </div>
      ) : (
        <>
          <div className="product-grid">
            {result.products.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 6} />
            ))}
          </div>

          {result.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
              {page > 1 && (
                <Link
                  href={buildPageHref(basePath, query, page - 1)}
                  className="btn btn-ghost px-4 text-xs"
                >
                  Previous
                </Link>
              )}
              <span className="text-xs font-bold uppercase">
                Page {page} of {result.totalPages}
              </span>
              {page < result.totalPages && (
                <Link
                  href={buildPageHref(basePath, query, page + 1)}
                  className="btn btn-dark px-4 text-xs"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function buildPageHref(
  basePath: string,
  query: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "page" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}
