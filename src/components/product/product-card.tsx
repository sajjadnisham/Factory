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
      className="comic-card group flex flex-col overflow-hidden p-1"
    >
      <span className="sr-only">{product.name}</span>

      <div className="relative aspect-[3/4] overflow-hidden rounded-[21px] bg-[color-mix(in_srgb,var(--color-paper)_80%,transparent)]">
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
          <span className={`sticker ${badge.className} absolute left-2.5 top-2.5`}>
            {badge.label}
          </span>
        )}

        {!product.inStock && (
          <span className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-paper)_68%,transparent)]" aria-hidden />
        )}
      </div>

      <div className="flex items-end justify-between gap-2 px-2 pb-1.5 pt-2">
        <p className="text-[0.6rem] uppercase leading-tight tracking-[0.14em] text-[var(--color-steel)]">
          {product.inStock ? product.sizes.slice(0, 4).join(" · ") : "Out of stock"}
        </p>

        <div className="flex shrink-0 flex-col items-end leading-none">
          {discounted && (
            <span className="text-[10px] text-[var(--color-steel)] line-through">
              {formatMvr(product.comparePriceMinor!)}
            </span>
          )}
          <span className="display text-[0.95rem] leading-none tracking-[0.01em] sm:text-base">
            {formatMvr(product.priceMinor)}
          </span>
        </div>
      </div>
    </Link>
  );
}
