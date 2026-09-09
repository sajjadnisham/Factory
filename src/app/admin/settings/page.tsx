import { redirect } from "next/navigation";

import { BrandAssetsForm } from "@/components/admin/brand-assets-form";
import { SettingsForm } from "@/components/admin/settings-form";
import { getCurrentAdmin } from "@/lib/auth/session";
import { BRAND_SLOTS, getBrandAssets, type BrandSlot } from "@/lib/brand";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin");

  const [settings, assets] = await Promise.all([getSettings(), getBrandAssets()]);

  const slots = (Object.keys(BRAND_SLOTS) as BrandSlot[]).map((key) => {
    const asset = assets[key];
    return {
      key,
      label: BRAND_SLOTS[key],
      uploaded: Boolean(asset),
      updatedAt: asset ? asset.updatedAt.toISOString() : null,
      sizeKb: asset ? Math.max(1, Math.round(asset.size / 1024)) : null,
    };
  });

  return (
    <div>
      <h1 className="section-title mb-1">Store settings</h1>
      <p className="mb-4 text-xs text-[var(--color-steel)]">
        These values drive the storefront. Contact fields are blank until you
        fill them in — nothing is invented.
      </p>
      <div className="grid gap-5">
        <BrandAssetsForm slots={slots} />
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
