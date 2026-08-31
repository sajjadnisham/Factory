import { redirect } from "next/navigation";

import { SettingsForm } from "@/components/admin/settings-form";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin");

  const settings = await getSettings();

  return (
    <div>
      <h1 className="section-title mb-1">Store settings</h1>
      <p className="mb-4 text-xs text-[var(--color-steel)]">
        These values drive the storefront. Contact fields are blank until you
        fill them in — nothing is invented.
      </p>
      <SettingsForm settings={settings} />
    </div>
  );
}
