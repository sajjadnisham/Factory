import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getCart } from "@/lib/cart";
import { formatMvr } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [cart, settings, customer] = await Promise.all([
    getCart(),
    getSettings(),
    getCurrentCustomer(),
  ]);

  if (cart.lines.length === 0) redirect("/cart");

  return (
    <div className="mx-auto max-w-2xl px-3 py-4">
      <h1 className="section-title mb-3">Checkout</h1>

      <section className="comic-card mb-4 p-3">
        <h2 className="field-label">Your order</h2>
        <ul className="grid gap-2">
          {cart.lines.map((line) => (
            <li key={line.id} className="flex items-center gap-2.5">
              <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded border-2 border-[var(--color-ink)] bg-[var(--color-paper)]">
                {line.imageUrl && (
                  <Image
                    src={line.imageUrl}
                    alt={line.productName}
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold uppercase">{line.productName}</p>
                <p className="text-xs text-[var(--color-steel)]">
                  {line.size} · {line.color} · ×{line.quantity}
                </p>
              </div>
              <p className="text-sm font-black">{formatMvr(line.lineTotalMinor)}</p>
            </li>
          ))}
        </ul>
        <Link href="/cart" className="mt-3 inline-block text-xs uppercase underline">
          Edit cart
        </Link>
      </section>

      <CheckoutFlow
        subtotalMinor={cart.subtotalMinor}
        deliveryFeeMinor={cart.deliveryFeeMinor}
        totalMinor={cart.totalMinor}
        itemCount={cart.itemCount}
        deliveryAreas={settings.deliveryAreas}
        paymentMethods={settings.paymentMethods
          .filter((m) => m.enabled)
          .map(({ id, label, description }) => ({ id, label, description }))}
        signedInName={customer?.name ?? null}
        signedInPhone={customer?.phone ?? null}
      />
    </div>
  );
}
