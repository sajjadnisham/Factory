import type { Metadata } from "next";
import Link from "next/link";

import { ProductUploadForm } from "@/components/admin/product-upload-form";
import { UploadedProductList } from "@/components/admin/uploaded-product-list";
import { env } from "@/lib/env";
import { listUploadedProducts } from "@/lib/products/upload";
import { getStorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Upload products" };

export default async function UploadPage() {
  const provider = env().STORAGE_PROVIDER;
  const usable = provider === "database";

  // Only meaningful once the database provider is the configured one; listing
  // uploads the sync will never read would be misleading.
  const uploaded = usable ? await listUploadedProducts() : [];

  return (
    <div className="grid gap-5">
      <div>
        <Link href="/admin/products" className="text-xs font-bold uppercase underline">
          ← Products
        </Link>
      </div>

      {!usable && (
        <div className="comic-card border-[var(--color-electric)] p-4">
          <h2 className="section-title">Uploads are not the active source</h2>
          <p className="mt-2 text-sm">
            This store reads its catalogue from{" "}
            <strong>{getStorageProvider().name}</strong>. Anything uploaded here
            is stored, but sync will not read it, so it will not reach the shop.
          </p>
          <p className="mt-2 text-sm">
            To use uploads, set <code className="rounded bg-[var(--color-paper)] px-1">STORAGE_PROVIDER</code>{" "}
            to <code className="rounded bg-[var(--color-paper)] px-1">database</code> in the
            hosting dashboard and redeploy. Products from the old source stay in
            the catalogue until the next sync deactivates them.
          </p>
        </div>
      )}

      <ProductUploadForm />

      <UploadedProductList
        products={uploaded.map((p) => ({ ...p, modifiedAt: p.modifiedAt.toISOString() }))}
      />
    </div>
  );
}
