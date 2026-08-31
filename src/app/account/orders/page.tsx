import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { statusLabel } from "@/components/order/order-timeline";
import { getCurrentCustomer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMvr } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My orders",
  robots: { index: false, follow: false },
};

export default async function OrdersPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account");

  const orders = await db.order.findMany({
    where: { customerId: customer.id },
    orderBy: { placedAt: "desc" },
    include: { items: { select: { quantity: true } } },
  });

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      <h1 className="section-title mb-3">My orders</h1>

      {orders.length === 0 ? (
        <div className="comic-card p-5 text-center">
          <p className="display text-lg">No orders yet</p>
          <Link href="/shop" className="btn btn-primary mt-4 text-sm">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="grid gap-2.5">
          {orders.map((order) => {
            const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
            return (
              <li key={order.id}>
                <Link
                  href={`/order/${order.orderNumber}`}
                  className="comic-card flex items-center justify-between p-3.5"
                >
                  <div>
                    <p className="text-sm font-black">#{order.orderNumber}</p>
                    <p className="text-xs text-[var(--color-steel)]">
                      {order.placedAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}{" "}
                      · {itemCount} item{itemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black">{formatMvr(order.totalMinor)}</p>
                    <p className="text-xs font-bold uppercase text-[var(--color-graphite)]">
                      {statusLabel(order.status)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/account" className="mt-4 block text-center text-xs uppercase underline">
        Back to account
      </Link>
    </div>
  );
}
