import Image from "next/image";
import Link from "next/link";

import type { CatalogProduct } from "@/lib/catalog";
import { formatMvr } from "@/lib/money";

/**
 * Comic-styled product card: hard border, offset shadow, sticker badge, bold
 * type. The photograph itself stays realistic — only the frame is stylised.
 *
 * Sized to work three-across from 320px up, so every element is tuned small:
 * two-line name clamp, price on its own line, no decorative filler that would
 * push the card taller.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: CatalogProduct;
  priority?: boolean;
}) {
  const image = product.images[0];
  const discounted =
    product.comparePriceMinor !== null &&
    product.comparePriceMinor > product.priceMinor;

  const badge = !product.inStock
    ? { className: "sticker-out", label: "Sold out" }
    : discounted
      ? { className: "sticker-sale", label: "Sale" }
      : product.newArrival
        ? { className: "sticker-new", label: "New" }
        : product.totalStock <= 3
          ? { className: "sticker-low", label: `${product.totalStock} left` }
          : null;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="comic-card group flex flex-col overflow-hidden"
    >
      <div className="relative aspect-[3/4] overflow-hidden border-b-[2.5px] border-[var(--color-ink)] bg-[var(--color-paper)]">
        {image ? (
          <Image
            src={image.url}
            alt={product.name}
            fill
            // Three across on phones, four on tablets, five on desktop — the
            // browser must not download a 900px file for a 110px slot.
            sizes="(max-width: 767px) 33vw, (max-width: 1099px) 25vw, 20vw"
            className="object-cover"
            priority={priority}
            loading={priority ? undefined : "lazy"}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] uppercase text-[var(--color-steel)]">
            No image
          </div>
        )}

        {badge && (
          <span className={`sticker ${badge.className} absolute left-1.5 top-1.5`}>
            {badge.label}
          </span>
        )}

        {!product.inStock && (
          <span className="absolute inset-0 bg-white/55" aria-hidden />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-1.5 sm:p-2">
        <h3
          className="line-clamp-2 text-[11px] font-bold uppercase leading-tight sm:text-xs"
          title={product.name}
        >
          {product.name}
        </h3>

        <div className="mt-auto flex flex-wrap items-baseline gap-x-1">
          <span className="text-[13px] font-black leading-none sm:text-sm">
            {formatMvr(product.priceMinor)}
          </span>
          {discounted && (
            <span className="text-[10px] leading-none text-[var(--color-steel)] line-through">
              {formatMvr(product.comparePriceMinor!)}
            </span>
          )}
        </div>

        <p className="text-[9px] uppercase leading-none text-[var(--color-steel)] sm:text-[10px]">
          {product.inStock ? product.sizes.slice(0, 4).join(" · ") : "Out of stock"}
        </p>
      </div>
    </Link>
  );
}
