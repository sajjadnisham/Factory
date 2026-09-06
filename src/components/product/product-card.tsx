import Image from "next/image";
import Link from "next/link";

import type { CatalogProduct } from "@/lib/catalog";
import { formatMvr } from "@/lib/money";

/**
 * A product is its photograph. Everything else sits on top of it.
 *
 * The card used to be a frame with a picture inset inside it — the surface had
 * its own border and radius, and the image had a second one a few pixels in.
 * At two across that read as a picture inside a picture, and against a gradient
 * ground it doubled the number of edges on screen. The photo now fills the card
 * to its corners and the size run and price sit over the bottom of it, on a
 * scrim, which is how the reference frames its artwork.
 *
 * The product name is deliberately not printed: at this size the photo
 * identifies the piece, and dropping the name lets the price be the one piece
 * of type with weight. It is still the image's alt text and an sr-only label,
 * so the link keeps its accessible name.
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
   * card is nearly twice as wide and would otherwise be handed a file too small.
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
      className="comic-card group relative block aspect-[3/4] overflow-hidden"
    >
      <span className="sr-only">{product.name}</span>

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
        <span className="flex h-full items-center justify-center text-[10px] uppercase text-[var(--color-steel)]">
          No image
        </span>
      )}

      {badge && (
        <span className={`sticker ${badge.className} absolute left-2.5 top-2.5`}>
          {badge.label}
        </span>
      )}

      {!product.inStock && (
        <span
          className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-paper)_62%,transparent)]"
          aria-hidden
        />
      )}

      {/* Scrim only where the type falls, so it darkens the hem of the photo
          rather than veiling the whole thing. */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[color-mix(in_srgb,#000000_78%,transparent)] via-[color-mix(in_srgb,#000000_34%,transparent)] to-transparent"
        aria-hidden
      />

      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
        <span className="text-[0.6rem] uppercase leading-tight tracking-[0.14em] text-chalk/70">
          {product.inStock ? product.sizes.slice(0, 4).join(" · ") : "Out of stock"}
        </span>

        <span className="flex shrink-0 flex-col items-end leading-none">
          {discounted && (
            <span className="text-[0.6rem] text-chalk/50 line-through">
              {formatMvr(product.comparePriceMinor!)}
            </span>
          )}
          <span className="display text-[0.95rem] leading-none tracking-[0.01em] text-chalk sm:text-base">
            {formatMvr(product.priceMinor)}
          </span>
        </span>
      </span>
    </Link>
  );
}
