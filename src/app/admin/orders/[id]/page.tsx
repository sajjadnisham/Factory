import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrderAdminControls } from "@/components/admin/order-admin-controls";
import { getCurrentAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMvr } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin");

  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) notFound();

  return (
    <div className="grid gap-4">
      <div>
        <Link href="/admin/orders" className="text-xs uppercase underline">
          ← All orders
        </Link>
        <h1 className="section-title mt-1.5">#{order.orderNumber}</h1>
        <p className="text-xs text-[var(--color-steel)]">
          Placed {order.placedAt.toLocaleString("en-GB")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="comic-card p-4">
          <h2 className="field-label">Items</h2>
          <ul className="grid gap-2 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span>
                  {item.productName}
                  <span className="block text-xs text-[var(--color-steel)]">
                    {item.size} · {item.color} · ×{item.quantity} · {item.sku}
                  </span>
                </span>
                <span className="font-bold">{formatMvr(item.lineTotalMinor)}</span>
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
              <dd>{formatMvr(order.deliveryFeeMinor)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t-2 border-[var(--color-ink)] pt-2 font-black">
              <dt>Total</dt>
              <dd>{formatMvr(order.totalMinor)}</dd>
            </div>
          </dl>
        </section>

        <section className="comic-card p-4">
          <h2 className="field-label">Customer &amp; delivery</h2>
          <p className="text-sm">
            <strong>{order.customer.name}</strong>
            <br />
            {formatPhone(order.customer.phone)}
          </p>
          <p className="mt-2.5 text-sm">
            {order.shipRecipientName}
            <br />
            {order.shipAddressLine}
            <br />
            {order.shipArea}
            {order.shipIsland ? `, ${order.shipIsland}` : ""}
          </p>
          {order.shipInstructions && (
            <p className="mt-1.5 text-xs text-[var(--color-steel)]">
              Note: {order.shipInstructions}
            </p>
          )}
          <p className="mt-3 text-xs text-[var(--color-steel)]">
            This is the address as it was at order time — editing the customer's
            saved address does not change it.
          </p>
        </section>
      </div>

      <section className="comic-card p-4">
        <h2 className="field-label">Manage</h2>
        <OrderAdminControls
          orderId={order.id}
          status={order.status}
          paymentStatus={order.paymentStatus}
        />
      </section>

      <section className="comic-card p-4">
        <h2 className="field-label">History</h2>
        <ul className="grid gap-1.5 text-sm">
          {order.events.map((event) => (
            <li key={event.id} className="flex gap-2">
              <span className="text-xs text-[var(--color-steel)]">
                {event.createdAt.toLocaleString("en-GB")}
              </span>
              <span className="font-bold uppercase">{event.status.replace(/_/g, " ")}</span>
              {event.note && <span className="text-[var(--color-graphite)]">— {event.note}</span>}
              {event.actor && (
                <span className="ml-auto text-xs text-[var(--color-steel)]">
                  {event.actor}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
