import Link from "next/link";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { SyncPanel } from "@/components/admin/sync-panel";
import { getCurrentAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMvr } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
        <h1 className="section-title mb-1">Admin sign in</h1>
        <p className="mb-4 text-sm text-[var(--color-graphite)]">
          Store staff only.
        </p>
        <AdminLoginForm />
      </div>
    );
  }

  // Fetched before the rest so the issue count can be scoped to it. Counting
  // every issue ever recorded would climb with each sync and stop describing
  // the catalogue as it currently stands.
  const lastSync = await db.syncRun.findFirst({ orderBy: { startedAt: "desc" } });

  const [
    paidTotal,
    orderCount,
    pendingCount,
    deliveredCount,
    cancelledCount,
    productCount,
    inactiveCount,
    customerCount,
    lowStock,
    openIssues,
    recentOrders,
  ] = await Promise.all([
    db.order.aggregate({
      _sum: { totalMinor: true },
      where: { paymentStatus: "paid" },
    }),
    db.order.count(),
    db.order.count({ where: { status: { in: ["pending", "confirmed", "processing"] } } }),
    db.order.count({ where: { status: "delivered" } }),
    db.order.count({ where: { status: "cancelled" } }),
    db.product.count({ where: { active: true } }),
    db.product.count({ where: { active: false } }),
    db.customer.count(),
    db.productVariant.findMany({
      where: { product: { active: true }, stock: { lte: 3 } },
      include: { product: { select: { name: true, sku: true, slug: true } } },
      orderBy: { stock: "asc" },
      take: 8,
    }),
    db.productSyncIssue.count({
      where: { severity: "error", syncRunId: lastSync?.id ?? "__none__" },
    }),
    db.order.findMany({
      orderBy: { placedAt: "desc" },
      take: 6,
      include: { customer: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="grid gap-5">
      <section>
        <h1 className="section-title mb-3">Dashboard</h1>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Stat label="Sales (paid)" value={formatMvr(paidTotal._sum.totalMinor ?? 0)} accent />
          <Stat label="Orders" value={String(orderCount)} />
          <Stat label="Needs action" value={String(pendingCount)} />
          <Stat label="Delivered" value={String(deliveredCount)} />
          <Stat label="Cancelled" value={String(cancelledCount)} />
          <Stat label="Active products" value={String(productCount)} />
          <Stat label="Hidden products" value={String(inactiveCount)} />
          <Stat label="Customers" value={String(customerCount)} />
        </div>
      </section>

      <section>
        <h2 className="section-title mb-2 text-lg">Stock sync</h2>
        <SyncPanel
          lastRun={
            lastSync
              ? {
                  startedAt: lastSync.startedAt.toISOString(),
                  status: lastSync.status,
                  productsFound: lastSync.productsFound,
                  productsNew: lastSync.productsNew,
                  productsUpdated: lastSync.productsUpdated,
                  productsRemoved: lastSync.productsRemoved,
                  imagesUpdated: lastSync.imagesUpdated,
                  invalidProducts: lastSync.invalidProducts,
                  triggeredBy: lastSync.triggeredBy,
                }
              : null
          }
          openIssueCount={openIssues}
        />
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="section-title text-lg">Recent orders</h2>
            <Link href="/admin/orders" className="text-xs font-bold uppercase underline">
              All orders
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="comic-card p-4 text-sm text-[var(--color-steel)]">
              No orders yet.
            </p>
          ) : (
            <ul className="grid gap-2">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="comic-card flex items-center justify-between p-3"
                  >
                    <div>
                      <p className="text-sm font-black">#{order.orderNumber}</p>
                      <p className="text-xs text-[var(--color-steel)]">
                        {order.customer.name} ·{" "}
                        {order.placedAt.toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black">{formatMvr(order.totalMinor)}</p>
                      <p className="text-[10px] font-bold uppercase">
                        {order.status.replace(/_/g, " ")} · {order.paymentStatus}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="section-title mb-2 text-lg">Low stock</h2>
          {lowStock.length === 0 ? (
            <p className="comic-card p-4 text-sm text-[var(--color-steel)]">
              Nothing running low.
            </p>
          ) : (
            <ul className="comic-card divide-y-2 divide-[var(--color-paper)] p-3">
              {lowStock.map((variant) => (
                <li key={variant.id} className="flex justify-between py-1.5 text-sm">
                  <span className="truncate">
                    {variant.product.name}{" "}
                    <span className="text-[var(--color-steel)]">
                      {variant.size}/{variant.color}
                    </span>
                  </span>
                  <span
                    className={`ml-2 font-black ${
                      variant.stock === 0 ? "text-[var(--color-danger)]" : ""
                    }`}
                  >
                    {variant.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`comic-card p-3 ${accent ? "bg-[var(--color-volt)]" : ""}`}>
      <p className="text-[10px] font-bold uppercase text-[var(--color-graphite)]">
        {label}
      </p>
      <p className="display mt-0.5 text-xl">{value}</p>
    </div>
  );
}
