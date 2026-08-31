import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AddressForm } from "@/components/account/address-form";
import { getCurrentCustomer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved address",
  robots: { index: false, follow: false },
};

export default async function AddressPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account");

  const [address, settings] = await Promise.all([
    db.address.findFirst({
      where: { customerId: customer.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    }),
    getSettings(),
  ]);

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      <h1 className="section-title mb-1">Saved address</h1>
      <p className="mb-3 text-xs text-[var(--color-steel)]">
        Used automatically at checkout. Past orders keep the address they were
        placed with.
      </p>

      <AddressForm
        deliveryAreas={settings.deliveryAreas}
        fallbackName={customer.name}
        initial={
          address
            ? {
                recipientName: address.recipientName,
                addressLine: address.addressLine,
                area: address.area,
                island: address.island,
                instructions: address.instructions ?? "",
              }
            : null
        }
      />

      <Link href="/account" className="mt-4 block text-center text-xs uppercase underline">
        Back to account
      </Link>
    </div>
  );
}
