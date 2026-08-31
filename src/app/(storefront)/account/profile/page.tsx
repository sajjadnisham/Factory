import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/account/profile-form";
import { getCurrentCustomer } from "@/lib/auth/session";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account");

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      <h1 className="section-title mb-3">Edit profile</h1>
      <ProfileForm
        initialName={customer.name}
        phoneDisplay={formatPhone(customer.phone)}
      />
      <Link href="/account" className="mt-4 block text-center text-xs uppercase underline">
        Back to account
      </Link>
    </div>
  );
}
