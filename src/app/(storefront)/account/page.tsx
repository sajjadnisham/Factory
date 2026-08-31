import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/account/login-form";
import { LogoutButton } from "@/components/account/logout-button";
import { getCurrentCustomer } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <div className="mx-auto max-w-md px-3 py-6">
        <h1 className="section-title">My account</h1>
        <p className="mt-1.5 text-sm text-[var(--color-graphite)]">
          Sign in with your phone number. No password — we send you a code.
        </p>
        <div className="mt-4">
          <LoginForm />
        </div>
        <p className="mt-5 text-center text-xs text-[var(--color-steel)]">
          New here? You do not need an account to shop — one is created
          automatically with your first order.
        </p>
      </div>
    );
  }

  const [orderCount, address] = await Promise.all([
    db.order.count({ where: { customerId: customer.id } }),
    db.address.findFirst({
      where: { customerId: customer.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      <section className="comic-card p-4">
        <h1 className="section-title">My account</h1>
        <p className="mt-1.5 text-lg font-bold">{customer.name}</p>
        <p className="text-sm text-[var(--color-steel)]">
          {formatPhone(customer.phone)}
        </p>
      </section>

      <nav className="mt-3 grid gap-2">
        <AccountLink
          href="/account/orders"
          label="My orders"
          hint={`${orderCount} order${orderCount === 1 ? "" : "s"}`}
        />
        <AccountLink
          href="/account/address"
          label="Saved address"
          hint={address ? address.area : "Not saved yet"}
        />
        <AccountLink href="/account/profile" label="Edit profile" hint="Name" />
      </nav>

      <div className="mt-4">
        <LogoutButton />
      </div>
    </div>
  );
}

function AccountLink({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="comic-card flex items-center justify-between p-3.5"
    >
      <span className="text-sm font-bold uppercase">{label}</span>
      <span className="flex items-center gap-2 text-xs text-[var(--color-steel)]">
        {hint}
        <span aria-hidden className="text-base">›</span>
      </span>
    </Link>
  );
}
