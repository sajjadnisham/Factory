import type { MetadataRoute } from "next";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Includes every active product, so newly synced products get indexed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";

  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
    }),
    db.category.findMany({
      where: { products: { some: { active: true } } },
      select: { slug: true },
    }),
  ]);

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({
      url: `${base}/shop/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${base}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...["privacy", "terms", "returns", "shipping", "contact"].map((slug) => ({
      url: `${base}/pages/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
