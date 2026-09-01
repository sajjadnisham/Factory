import type { Metadata } from "next";
import Link from "next/link";

import { AdminLogout } from "@/components/admin/admin-logout";
import { DemoBanner } from "@/components/layout/demo-banner";
import { getCurrentAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  // The admin area must never appear in search results.
  robots: { index: false, follow: false, nocache: true },
};

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();

  // Signed out, the only page here is the login form — no admin navigation to
  // show, and deliberately no storefront chrome either.
  if (!admin) {
    return (
      <div className="min-h-dvh bg-[var(--color-paper)]">
        <DemoBanner />
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-paper)]">
      <DemoBanner />
      <header className="border-b-[2.5px] border-[var(--color-ink)] bg-[var(--color-ink)] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/admin" className="display text-lg text-[var(--color-volt)]">
            Admin
          </Link>
          <nav className="flex flex-wrap gap-3 text-xs font-bold uppercase">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-[var(--color-volt)]">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <Link href="/" className="underline">View store</Link>
            <span className="text-[var(--color-mist)]">{admin.username}</span>
            <AdminLogout />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}
