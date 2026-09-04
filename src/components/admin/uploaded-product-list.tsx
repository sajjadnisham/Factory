"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteUploadedProductAction } from "@/app/actions/admin-actions";

interface Props {
  products: { name: string; fileCount: number; totalBytes: number; modifiedAt: string }[];
}

/**
 * The uploaded folders, with the storage each one costs.
 *
 * The size column is not decoration: uploads live in the same Postgres instance
 * as the orders, and on a free plan that is 1GB for everything. Seeing the cost
 * per product is what stops someone discovering the ceiling by hitting it.
 */
export function UploadedProductList({ products }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (products.length === 0) {
    return (
      <p className="comic-card p-4 text-sm text-[var(--color-graphite)]">
        Nothing uploaded yet. Products added above appear here.
      </p>
    );
  }

  const total = products.reduce((sum, p) => sum + p.totalBytes, 0);

  function remove(name: string) {
    setError(null);
    setRemoving(name);
    startTransition(async () => {
      const result = await deleteUploadedProductAction(name);
      if (!result.ok) setError(result.error);
      setRemoving(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="section-title">Uploaded products</h2>
        <p className="text-xs text-[var(--color-steel)]">
          {products.length} folder{products.length === 1 ? "" : "s"} · {mb(total)} used
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border-2 border-[var(--color-electric)] bg-white p-2.5 text-xs font-semibold text-[var(--color-electric)]">
          {error}
        </p>
      )}

      <ul className="grid gap-1.5">
        {products.map((product) => (
          <li key={product.name} className="comic-card flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold uppercase">{product.name}</p>
              <p className="text-xs text-[var(--color-steel)]">
                {product.fileCount - 1} photo{product.fileCount - 1 === 1 ? "" : "s"} · {mb(product.totalBytes)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(product.name)}
              disabled={pending}
              className="btn btn-ghost shrink-0 px-3 text-xs"
            >
              {removing === product.name ? "Removing…" : "Remove"}
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[var(--color-graphite)]">
        Removing a folder deactivates its product and hides it from the shop.
        Past orders keep their own copy of what was bought, so order history is
        never affected.
      </p>
    </div>
  );
}

function mb(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
