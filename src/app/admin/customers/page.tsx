import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMvr } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin");

  const customers = await db.customer.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      orders: { select: { totalMinor: true, paymentStatus: true } },
      addresses: { where: { isDefault: true }, take: 1 },
    },
  });

  return (
    <div>
      <h1 className="section-title mb-1">Customers</h1>
      <p className="mb-3 text-xs text-[var(--color-steel)]">
        Accounts are created automatically from a verified phone number at first
        order.
      </p>

      {customers.length === 0 ? (
        <p className="comic-card p-4 text-sm">No customers yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b-[2.5px] border-[var(--color-ink)] text-left text-[10px] uppercase">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Orders</th>
                <th className="py-2 pr-3">Paid value</th>
                <th className="py-2 pr-3">Area</th>
                <th className="py-2 pr-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const paid = customer.orders
                  .filter((o) => o.paymentStatus === "paid")
                  .reduce((sum, o) => sum + o.totalMinor, 0);
                return (
                  <tr key={customer.id} className="border-b border-[var(--color-mist)]">
                    <td className="py-2 pr-3 font-bold">{customer.name}</td>
                    <td className="py-2 pr-3">{formatPhone(customer.phone)}</td>
                    <td className="py-2 pr-3">{customer.orders.length}</td>
                    <td className="py-2 pr-3">{formatMvr(paid)}</td>
                    <td className="py-2 pr-3 text-xs">
                      {customer.addresses[0]?.area ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs text-[var(--color-steel)]">
                      {customer.createdAt.toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
