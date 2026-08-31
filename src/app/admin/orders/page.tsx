import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMvr } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "processing", label: "Processing" },
  { id: "packed", label: "Packed" },
  { id: "out_for_delivery", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin");

  const { status } = await searchParams;
  const active = status && status !== "all" ? status : null;

  const orders = await db.order.findMany({
    where: active ? { status: active } : {},
    orderBy: { placedAt: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true, phone: true } },
      items: { select: { quantity: true } },
    },
  });

  return (
    <div>
      <h1 className="section-title mb-3">Orders</h1>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => (
          <Link
            key={filter.id}
            href={filter.id === "all" ? "/admin/orders" : `/admin/orders?status=${filter.id}`}
            className={`btn shrink-0 px-3 text-xs ${
              (active ?? "all") === filter.id ? "btn-dark" : "btn-ghost"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="comic-card p-4 text-sm">No orders in this view.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b-[2.5px] border-[var(--color-ink)] text-left text-[10px] uppercase">
                <th className="py-2 pr-3">Order</th>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Items</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Payment</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--color-mist)]">
                  <td className="py-2 pr-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-black underline"
                    >
                      #{order.orderNumber}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    {order.customer.name}
                    <span className="block text-xs text-[var(--color-steel)]">
                      {formatPhone(order.customer.phone)}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {order.items.reduce((s, i) => s + i.quantity, 0)}
                  </td>
                  <td className="py-2 pr-3 font-bold">{formatMvr(order.totalMinor)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`sticker ${
                        order.paymentStatus === "paid" ? "sticker-new" : "sticker-low"
                      }`}
                    >
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs font-bold uppercase">
                    {order.status.replace(/_/g, " ")}
                  </td>
                  <td className="py-2 pr-3 text-xs text-[var(--color-steel)]">
                    {order.placedAt.toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
