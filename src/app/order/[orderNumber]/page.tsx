import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderTimeline, statusLabel } from "@/components/order/order-timeline";
import { getCurrentCustomer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMvr } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const [{ orderNumber }, { placed }] = await Promise.all([params, searchParams]);

  const customer = await getCurrentCustomer();
  if (!customer) notFound();

  // Scoped to the signed-in customer, so guessing an order number reveals
  // nothing about another customer's order.
  const order = await db.order.findFirst({
    where: { orderNumber, customerId: customer.id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) notFound();

  const payment = order.payments[0];

  return (
    <div className="mx-auto max-w-2xl px-3 py-4">
      {placed === "1" && (
        <div className="comic-card mb-4 border-[var(--color-success)] bg-[var(--color-volt)] p-4">
          <p className="display text-xl">Order confirmed</p>
          <p className="mt-1 text-sm">
            Thanks {order.shipRecipientName.split(" ")[0]} — we have your order and
            your account is ready. Your address is saved for next time.
          </p>
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <h1 className="section-title">#{order.orderNumber}</h1>
        <span className="sticker sticker-new">{statusLabel(order.status)}</span>
      </div>
      <p className="mt-1 text-xs text-[var(--color-steel)]">
        Placed {order.placedAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
      </p>

      <section className="comic-card mt-4 p-3.5">
        <h2 className="field-label">Progress</h2>
        <OrderTimeline status={order.status} />
      </section>

      <section className="comic-card mt-3 p-3.5">
        <h2 className="field-label">Items</h2>
        <ul className="grid gap-2.5">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5">
              <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded border-2 border-[var(--color-ink)] bg-[var(--color-paper)]">
                {item.imageUrl && (
                  <Image
                    src={item.imageUrl}
                    alt={item.productName}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold uppercase">{item.productName}</p>
                <p className="text-xs text-[var(--color-steel)]">
                  {item.size} · {item.color} · ×{item.quantity} · {item.sku}
                </p>
              </div>
              <p className="text-sm font-black">{formatMvr(item.lineTotalMinor)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-3 border-t-2 border-[var(--color-ink)] pt-2.5 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatMvr(order.subtotalMinor)}</dd>
          </div>
          <div className="mt-1 flex justify-between">
            <dt>Delivery</dt>
            <dd>
              {order.deliveryFeeMinor === 0 ? "Free" : formatMvr(order.deliveryFeeMinor)}
            </dd>
          </div>
          <div className="mt-2 flex justify-between border-t-2 border-[var(--color-ink)] pt-2 font-black">
            <dt>Total</dt>
            <dd>{formatMvr(order.totalMinor)}</dd>
          </div>
        </dl>
      </section>

      <section className="comic-card mt-3 p-3.5">
        <h2 className="field-label">Payment</h2>
        <p className="text-sm">
          <span className="font-bold uppercase">{order.paymentStatus}</span>
          {payment && ` · ${payment.method.replace(/_/g, " ")}`}
        </p>
        {order.paymentStatus !== "paid" && (
          <p className="mt-1.5 text-xs text-[var(--color-graphite)]">
            We will confirm your order once payment is received. Use{" "}
            <strong>{order.orderNumber}</strong> as your transfer reference.
          </p>
        )}
      </section>

      <section className="comic-card mt-3 p-3.5">
        <h2 className="field-label">Delivery address</h2>
        <p className="text-sm">
          {order.shipRecipientName}
          <br />
          {order.shipAddressLine}
          <br />
          {order.shipArea}
          {order.shipIsland ? `, ${order.shipIsland}` : ""}
          <br />
          {formatPhone(order.shipPhone)}
        </p>
        {order.shipInstructions && (
          <p className="mt-1.5 text-xs text-[var(--color-steel)]">
            Note: {order.shipInstructions}
          </p>
        )}
      </section>

      <div className="mt-4 grid gap-2">
        <Link href="/account/orders" className="btn btn-ghost text-sm">
          My orders
        </Link>
        <Link href="/shop" className="btn btn-primary text-sm">
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
