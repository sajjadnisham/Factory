"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  removeFromCartAction,
  updateCartLineAction,
} from "@/app/actions/cart-actions";
import type { CartLine } from "@/lib/cart";
import { formatMvr } from "@/lib/money";

export function CartLines({ lines }: { lines: CartLine[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeQuantity(variantId: string, quantity: number) {
    setError(null);
    startTransition(async () => {
      const result = await updateCartLineAction(variantId, quantity);
      if (!result.ok) setError(result.error ?? "Could not update the cart.");
      router.refresh();
    });
  }

  function remove(variantId: string) {
    startTransition(async () => {
      await removeFromCartAction(variantId);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2.5">
      {error && (
        <p role="alert" className="rounded-lg border-2 border-[var(--color-danger)] bg-white p-2.5 text-sm">
          {error}
        </p>
      )}

      {lines.map((line) => (
        <article key={line.id} className="comic-card flex gap-3 p-2.5">
          <Link
            href={`/product/${line.productSlug}`}
            className="relative h-24 w-[72px] shrink-0 overflow-hidden rounded border-2 border-[var(--color-ink)] bg-[var(--color-paper)]"
          >
            {line.imageUrl && (
              <Image
                src={line.imageUrl}
                alt={line.productName}
                fill
                sizes="72px"
                className="object-cover"
              />
            )}
          </Link>

          <div className="flex min-w-0 flex-1 flex-col">
            <Link href={`/product/${line.productSlug}`} className="text-sm font-bold uppercase">
              {line.productName}
            </Link>
            <p className="text-xs text-[var(--color-steel)]">
              {line.size} · {line.color}
            </p>

            {line.exceedsStock && (
              <p className="mt-1 text-xs font-bold text-[var(--color-danger)]">
                Only {line.availableStock} left
              </p>
            )}

            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => changeQuantity(line.variantId, line.quantity - 1)}
                  disabled={pending}
                  aria-label={`Decrease quantity of ${line.productName}`}
                  className="flex h-9 w-9 items-center justify-center rounded border-2 border-[var(--color-ink)] bg-white text-lg leading-none"
                >
                  −
                </button>
                <span className="w-7 text-center text-sm font-bold" aria-live="polite">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => changeQuantity(line.variantId, line.quantity + 1)}
                  disabled={pending || line.quantity >= line.availableStock}
                  aria-label={`Increase quantity of ${line.productName}`}
                  className="flex h-9 w-9 items-center justify-center rounded border-2 border-[var(--color-ink)] bg-white text-lg leading-none disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <p className="text-sm font-black">{formatMvr(line.lineTotalMinor)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => remove(line.variantId)}
            disabled={pending}
            aria-label={`Remove ${line.productName}`}
            className="self-start text-lg leading-none text-[var(--color-steel)]"
          >
            ✕
          </button>
        </article>
      ))}
    </div>
  );
}
