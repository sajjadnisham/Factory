import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductActiveToggle } from "@/components/admin/product-active-toggle";
import { getCurrentAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMvr } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin");

  const { tab } = await searchParams;
  const showIssues = tab === "issues";

  const [products, issues, latestRun] = await Promise.all([
    db.product.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        variants: true,
        images: { select: { id: true } },
        category: { select: { name: true } },
      },
    }),
    db.productSyncIssue.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  // Only issues from the most recent run are current; older ones describe
  // folders that may already have been fixed.
  const currentIssues = latestRun
    ? issues.filter((i) => i.syncRunId === latestRun.id)
    : [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/products/upload" className="btn btn-primary text-sm">
          Add a product
        </Link>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="section-title">Products</h1>
        <div className="ml-auto flex gap-2">
          <Link
            href="/admin/products"
            className={`btn px-3 text-xs ${!showIssues ? "btn-dark" : "btn-ghost"}`}
          >
            Catalogue ({products.length})
          </Link>
          <Link
            href="/admin/products?tab=issues"
            className={`btn px-3 text-xs ${showIssues ? "btn-dark" : "btn-ghost"}`}
          >
            Issues ({currentIssues.length})
          </Link>
        </div>
      </div>

      <p className="mb-3 text-xs text-[var(--color-steel)]">
        Products are created and edited in the STOCK folder, not here. Use
        Hide/Show only for a temporary override — the next sync re-applies what
        the folder says.
      </p>

      {showIssues ? (
        currentIssues.length === 0 ? (
          <p className="comic-card p-4 text-sm">
            No issues in the most recent sync.
          </p>
        ) : (
          <ul className="grid gap-2">
            {currentIssues.map((issue) => (
              <li
                key={issue.id}
                className={`comic-card p-3 ${
                  issue.severity === "error"
                    ? "border-[var(--color-danger)]"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase">{issue.folderName}</p>
                    <p className="mt-0.5 text-sm text-[var(--color-graphite)]">
                      {issue.message}
                    </p>
                  </div>
                  <span
                    className={`sticker shrink-0 ${
                      issue.severity === "error" ? "sticker-sale" : "sticker-low"
                    }`}
                  >
                    {issue.severity}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : products.length === 0 ? (
        <p className="comic-card p-4 text-sm">
          No products yet. Add folders to STOCK and run a sync.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b-[2.5px] border-[var(--color-ink)] text-left text-[10px] uppercase">
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Stock</th>
                <th className="py-2 pr-3">Images</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const stock = product.variants.reduce((s, v) => s + v.stock, 0);
                const price = product.variants[0]?.priceMinor ?? 0;
                return (
                  <tr key={product.id} className="border-b border-[var(--color-mist)]">
                    <td className="py-2 pr-3">
                      <span className="font-bold">{product.name}</span>
                      <span className="block text-xs text-[var(--color-steel)]">
                        {product.category?.name} · folder {product.externalFolderName}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{product.sku}</td>
                    <td className="py-2 pr-3">{formatMvr(price)}</td>
                    <td
                      className={`py-2 pr-3 font-bold ${
                        stock === 0 ? "text-[var(--color-danger)]" : ""
                      }`}
                    >
                      {stock}
                    </td>
                    <td className="py-2 pr-3">{product.images.length}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`sticker ${product.active ? "sticker-new" : "sticker-out"}`}
                      >
                        {product.active ? "Live" : "Hidden"}
                      </span>
                    </td>
                    <td className="py-2">
                      <ProductActiveToggle
                        productId={product.id}
                        active={product.active}
                      />
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
