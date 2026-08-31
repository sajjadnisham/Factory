"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { addToCartAction } from "@/app/actions/cart-actions";
import type { CatalogProduct } from "@/lib/catalog";
import { formatMvr } from "@/lib/money";

/**
 * Size/colour selection plus the two conversion actions.
 *
 * BUY NOW is the primary path: it adds the item and goes straight to checkout,
 * with no registration step in between. Add to cart is the secondary path.
 */
export function BuyPanel({ product }: { product: CatalogProduct }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState(product.colors[0] ?? "");
  const [size, setSize] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sizesForColor = useMemo(
    () =>
      product.variants
        .filter((v) => v.color === color)
        .sort((a, b) => product.sizes.indexOf(a.size) - product.sizes.indexOf(b.size)),
    [product, color],
  );

  const selected = sizesForColor.find((v) => v.size === size) ?? null;
  const displayPrice = selected?.priceMinor ?? product.priceMinor;
  const comparePrice = selected?.comparePriceMinor ?? product.comparePriceMinor;
  const discounted = comparePrice !== null && comparePrice > displayPrice;

  function run(then: "cart" | "checkout") {
    if (!selected) {
      setMessage("Choose a size first.");
      return;
    }
    setMessage(null);

    startTransition(async () => {
      const result = await addToCartAction(selected.id, 1);
      if (!result.ok) {
        setMessage(result.error ?? "Could not add that item.");
        return;
      }
      router.push(then === "checkout" ? "/checkout" : "/cart");
    });
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="display text-3xl">{formatMvr(displayPrice)}</span>
        {discounted && (
          <>
            <span className="text-base text-[var(--color-steel)] line-through">
              {formatMvr(comparePrice)}
            </span>
            <span className="sticker sticker-sale">
              Save {Math.round(((comparePrice - displayPrice) / comparePrice) * 100)}%
            </span>
          </>
        )}
      </div>

      {product.colors.length > 1 && (
        <fieldset>
          <legend className="field-label">Colour — {color}</legend>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setColor(option);
                  setSize(null);
                }}
                aria-pressed={color === option}
                className={`btn ${color === option ? "btn-dark" : "btn-ghost"} px-3 text-xs`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="field-label">
          Size {selected ? `— ${selected.size}` : ""}
        </legend>
        <div className="flex flex-wrap gap-2">
          {sizesForColor.map((variant) => {
            const soldOut = variant.stock < 1;
            return (
              <button
                key={variant.id}
                type="button"
                disabled={soldOut}
                onClick={() => setSize(variant.size)}
                aria-pressed={size === variant.size}
                title={soldOut ? "Out of stock" : `${variant.stock} available`}
                className={`btn px-3.5 text-xs ${
                  size === variant.size ? "btn-primary" : "btn-ghost"
                } ${soldOut ? "line-through" : ""}`}
              >
                {variant.size}
              </button>
            );
          })}
        </div>
      </fieldset>

      {selected && (
        <p className="text-xs font-semibold uppercase">
          {selected.stock < 1 ? (
            <span className="text-[var(--color-danger)]">Out of stock</span>
          ) : selected.lowStock ? (
            <span className="text-[var(--color-danger)]">
              Only {selected.stock} left
            </span>
          ) : (
            <span className="text-[var(--color-success)]">In stock</span>
          )}
        </p>
      )}

      {message && (
        <p role="alert" className="rounded-lg border-2 border-[var(--color-danger)] bg-white p-2.5 text-sm">
          {message}
        </p>
      )}

      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => run("checkout")}
          disabled={pending || !product.inStock}
          className="btn btn-primary w-full text-base"
        >
          {pending ? "Working…" : "Buy now"}
        </button>
        <button
          type="button"
          onClick={() => run("cart")}
          disabled={pending || !product.inStock}
          className="btn btn-ghost w-full text-sm"
        >
          Add to cart
        </button>
      </div>
    </section>
  );
}
