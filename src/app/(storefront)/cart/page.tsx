import type { Metadata } from "next";
import Link from "next/link";

import { CartLines } from "@/components/cart/cart-lines";
import { getCart } from "@/lib/cart";
import { formatMvr } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: true },
};

export default async function CartPage() {
  const [cart, settings] = await Promise.all([getCart(), getSettings()]);

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-3 py-10 text-center">
        <p className="display text-2xl">Your cart is empty</p>
        <p className="mt-2 text-sm text-[var(--color-graphite)]">
          Nothing here yet. Go find something worth wearing.
        </p>
        <Link href="/shop" className="btn btn-primary mt-5">
          Shop now
        </Link>
      </div>
    );
  }

  const awayFromFree =
    settings.freeDeliveryThresholdMinor - cart.subtotalMinor;

  return (
    <div className="mx-auto max-w-2xl px-3 py-4">
      <h1 className="section-title mb-3">
        Cart <span className="text-[var(--color-steel)]">({cart.itemCount})</span>
      </h1>

      <CartLines lines={cart.lines} />

      {awayFromFree > 0 && settings.freeDeliveryThresholdMinor > 0 && (
        <p className="mt-3 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-volt)] p-2.5 text-center text-xs font-bold uppercase">
          Add {formatMvr(awayFromFree)} more for free delivery
        </p>
      )}

      <dl className="comic-card mt-4 p-3.5 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{formatMvr(cart.subtotalMinor)}</dd>
        </div>
        <div className="mt-1.5 flex justify-between">
          <dt>Delivery</dt>
          <dd>
            {cart.deliveryFeeMinor === 0 ? "Free" : formatMvr(cart.deliveryFeeMinor)}
          </dd>
        </div>
        <div className="mt-2.5 flex justify-between border-t-2 border-[var(--color-ink)] pt-2.5 text-lg font-black">
          <dt>Total</dt>
          <dd>{formatMvr(cart.totalMinor)}</dd>
        </div>
      </dl>

      {cart.hasIssues && (
        <p role="alert" className="mt-3 rounded-lg border-2 border-[var(--color-danger)] bg-white p-3 text-sm">
          Some items exceed the stock we have left. Reduce the quantity to continue.
        </p>
      )}

      <Link
        href="/checkout"
        aria-disabled={cart.hasIssues}
        className={`btn btn-primary mt-4 w-full text-base ${
          cart.hasIssues ? "pointer-events-none opacity-45" : ""
        }`}
      >
        Checkout · {formatMvr(cart.totalMinor)}
      </Link>

      <Link href="/shop" className="mt-3 block text-center text-xs uppercase underline">
        Continue shopping
      </Link>
    </div>
  );
}
