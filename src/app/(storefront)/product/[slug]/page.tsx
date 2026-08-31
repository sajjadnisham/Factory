import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BuyPanel } from "@/components/product/buy-panel";
import { ProductCard } from "@/components/product/product-card";
import { ProductGallery } from "@/components/product/product-gallery";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { formatMvr } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  const description =
    product.description ||
    `${product.name} — ${formatMvr(product.priceMinor)}. Available in ${product.sizes.join(", ")}.`;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, settings] = await Promise.all([
    getRelatedProducts(product, 6),
    getSettings(),
  ]);

  // Product structured data, so the listing can show price and availability in
  // search results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.description,
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: settings.storeName },
    offers: {
      "@type": "Offer",
      priceCurrency: "MVR",
      price: (product.priceMinor / 100).toFixed(2),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-6xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="px-4 py-2.5 text-xs text-[var(--color-steel)]">
        <Link href="/shop" className="hover:underline">Shop</Link>
        {product.categorySlug && (
          <>
            {" / "}
            <Link href={`/shop/${product.categorySlug}`} className="hover:underline">
              {product.categoryName}
            </Link>
          </>
        )}
      </nav>

      <div className="md:grid md:grid-cols-2 md:gap-8 md:px-4">
        <div className="border-y-[2.5px] border-[var(--color-ink)] md:rounded-xl md:border-[2.5px] md:shadow-[6px_6px_0_var(--color-ink)] md:overflow-hidden">
          <ProductGallery images={product.images} productName={product.name} />
        </div>

        <div className="p-4 md:p-0">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {product.newArrival && <span className="sticker sticker-new">New</span>}
            {!product.inStock && <span className="sticker sticker-out">Sold out</span>}
          </div>

          <h1 className="text-2xl md:text-4xl">{product.name}</h1>
          <p className="mt-1 text-xs uppercase text-[var(--color-steel)]">
            {product.categoryName} · SKU {product.sku}
          </p>

          <div className="mt-4">
            <BuyPanel product={product} />
          </div>

          {product.description && (
            <section className="mt-6">
              <h2 className="field-label">Description</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-graphite)]">
                {product.description}
              </p>
            </section>
          )}

          <section className="mt-5 rounded-xl border-2 border-[var(--color-ink)] bg-white p-3.5 text-xs">
            <p className="font-bold uppercase">Delivery</p>
            <p className="mt-1 text-[var(--color-graphite)]">
              {settings.deliveryEstimate}.{" "}
              {settings.freeDeliveryThresholdMinor > 0 && (
                <>Free over {formatMvr(settings.freeDeliveryThresholdMinor)}.</>
              )}
            </p>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="px-4 py-6">
          <h2 className="section-title mb-2.5">You might also like</h2>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
