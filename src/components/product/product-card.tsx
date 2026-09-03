import Image from "next/image";
import Link from "next/link";

import type { CatalogProduct } from "@/lib/catalog";
import { formatMvr } from "@/lib/money";

/**
 * Comic-styled product card: hard border, offset shadow, sticker badge. The
 * photograph itself stays realistic — only the frame is stylised.
 *
 * The card carries the picture, the size run and the price, and nothing else.
 * The product name is deliberately not printed: at two cards across the picture
 * is large enough to identify the piece on its own, and dropping the name lets
 * the price be the one piece of type that carries weight. The name is still
 * exposed to screen readers and as the image's alt text, so the link keeps an
 * accessible name and nothing is lost to anyone reading the page without it.
 */
export function ProductCard({
  product,
  priority = false,
  sizes = "(max-width: 767px) 50vw, (max-width: 1099px) 25vw, 20vw",
}: {
  product: CatalogProduct;
  priority?: boolean;
  /**
   * Rendered width of the card, for the browser's image picker. The default
   * describes the shop grid; the homepage rails pass their own, because a rail
   * card is nearly twice as wide as a grid card and would otherwise be handed a
   * file too small for it.
   */
  sizes?: string;
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
      <span className="sr-only">{product.name}</span>

      <div className="relative aspect-[3/4] overflow-hidden border-b-[2.5px] border-[var(--color-ink)] bg-[var(--color-paper)]">
        {image ? (
          <Image
            src={image.url}
            alt={product.name}
            fill
            sizes={sizes}
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

      <div className="flex items-end justify-between gap-2 p-2 sm:p-2.5">
        <p className="text-[10px] font-semibold uppercase leading-tight text-[var(--color-steel)] sm:text-[11px]">
          {product.inStock ? product.sizes.slice(0, 4).join(" · ") : "Out of stock"}
        </p>

        <div className="flex shrink-0 flex-col items-end leading-none">
          {discounted && (
            <span className="text-[10px] text-[var(--color-steel)] line-through">
              {formatMvr(product.comparePriceMinor!)}
            </span>
          )}
          <span className="display text-base leading-none sm:text-lg">
            {formatMvr(product.priceMinor)}
          </span>
        </div>
      </div>
    </Link>
  );
}
