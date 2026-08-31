import { db } from "@/lib/db";
import { PRODUCT_TYPE_META, type ProductType } from "@/lib/products/schema";

/**
 * Read model for the storefront. Every query filters on `active`, so a product
 * whose folder was removed or deactivated disappears from the shop without any
 * component needing to remember the rule.
 */

export interface CatalogImage {
  id: string;
  url: string;
  fileName: string;
}

export interface CatalogVariant {
  id: string;
  size: string;
  color: string;
  priceMinor: number;
  comparePriceMinor: number | null;
  stock: number;
  lowStock: boolean;
}

export interface CatalogProduct {
  id: string;
  sku: string;
  slug: string;
  name: string;
  type: string;
  categoryName: string;
  categorySlug: string;
  description: string;
  featured: boolean;
  newArrival: boolean;
  images: CatalogImage[];
  variants: CatalogVariant[];
  priceMinor: number;
  comparePriceMinor: number | null;
  colors: string[];
  sizes: string[];
  totalStock: number;
  inStock: boolean;
}

const productInclude = {
  category: true,
  images: { orderBy: { sortOrder: "asc" } },
  variants: { orderBy: [{ color: "asc" }, { size: "asc" }] },
} satisfies NonNullable<Parameters<typeof db.product.findMany>[0]>["include"];

type ProductRow = Awaited<
  ReturnType<typeof db.product.findMany<{ include: typeof productInclude }>>
>[number];

function toCatalogProduct(row: ProductRow): CatalogProduct {
  const variants: CatalogVariant[] = row.variants.map((v) => ({
    id: v.id,
    size: v.size,
    color: v.color,
    priceMinor: v.priceMinor,
    comparePriceMinor: v.comparePriceMinor,
    stock: v.stock,
    lowStock: v.stock > 0 && v.stock <= v.lowStockThreshold,
  }));

  const prices = variants.map((v) => v.priceMinor);
  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);

  // Size order follows the garment convention, not alphabetical — "S, M, L, XL"
  // rather than "L, M, S, XL".
  const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  const sizes = [...new Set(variants.map((v) => v.size))].sort((a, b) => {
    const ia = sizeOrder.indexOf(a);
    const ib = sizeOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    type: row.type,
    categoryName: row.category?.name ?? "",
    categorySlug: row.category?.slug ?? "",
    description: row.description,
    featured: row.featured,
    newArrival: row.newArrival,
    images: row.images.map((i) => ({
      id: i.id,
      url: i.url ?? `/api/images/${i.id}`,
      fileName: i.fileName,
    })),
    variants,
    priceMinor: prices.length > 0 ? Math.min(...prices) : 0,
    comparePriceMinor: variants[0]?.comparePriceMinor ?? null,
    colors: [...new Set(variants.map((v) => v.color))],
    sizes,
    totalStock,
    inStock: totalStock > 0,
  };
}

export interface ProductQuery {
  categorySlug?: string;
  search?: string;
  colors?: string[];
  sizes?: string[];
  minPriceMinor?: number;
  maxPriceMinor?: number;
  inStockOnly?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "featured";
  page?: number;
  pageSize?: number;
}

export interface ProductPage {
  products: CatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function queryProducts(query: ProductQuery = {}): Promise<ProductPage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(60, Math.max(6, query.pageSize ?? 24));

  const where: Record<string, unknown> = { active: true };

  if (query.categorySlug) {
    where.category = { slug: query.categorySlug };
  }

  if (query.search?.trim()) {
    const term = query.search.trim();
    // Search covers the fields a shopper actually types: name, description,
    // SKU, product type and colour.
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
      { type: { contains: term, mode: "insensitive" } },
      { variants: { some: { color: { contains: term, mode: "insensitive" } } } },
    ];
  }

  const variantFilters: Record<string, unknown> = {};
  if (query.colors?.length) variantFilters.color = { in: query.colors };
  if (query.sizes?.length) variantFilters.size = { in: query.sizes };
  if (query.minPriceMinor !== undefined || query.maxPriceMinor !== undefined) {
    variantFilters.priceMinor = {
      ...(query.minPriceMinor !== undefined ? { gte: query.minPriceMinor } : {}),
      ...(query.maxPriceMinor !== undefined ? { lte: query.maxPriceMinor } : {}),
    };
  }
  if (query.inStockOnly) variantFilters.stock = { gt: 0 };
  if (Object.keys(variantFilters).length > 0) {
    where.variants = { some: variantFilters };
  }

  const orderBy = (() => {
    switch (query.sort) {
      case "price_asc":
        return [{ variants: { _count: "desc" } }, { createdAt: "desc" }] as never;
      case "featured":
        return [{ featured: "desc" }, { createdAt: "desc" }] as never;
      case "newest":
      default:
        return [{ newArrival: "desc" }, { createdAt: "desc" }] as never;
    }
  })();

  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      include: productInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.product.count({ where }),
  ]);

  let products = rows.map(toCatalogProduct);

  // Price sorting happens here because the sort key lives on variants: the
  // displayed price is the minimum across a product's variants, which SQL
  // cannot order by without a much heavier query.
  if (query.sort === "price_asc") {
    products = products.sort((a, b) => a.priceMinor - b.priceMinor);
  } else if (query.sort === "price_desc") {
    products = products.sort((a, b) => b.priceMinor - a.priceMinor);
  }

  return {
    products,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const row = await db.product.findFirst({
    where: { slug, active: true },
    include: productInclude,
  });
  return row ? toCatalogProduct(row) : null;
}

export async function getFeaturedProducts(limit = 6): Promise<CatalogProduct[]> {
  const rows = await db.product.findMany({
    where: { active: true, featured: true },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toCatalogProduct);
}

export async function getNewArrivals(limit = 6): Promise<CatalogProduct[]> {
  const rows = await db.product.findMany({
    where: { active: true, newArrival: true },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toCatalogProduct);
}

export async function getProductsByType(
  type: ProductType,
  limit = 6,
): Promise<CatalogProduct[]> {
  const rows = await db.product.findMany({
    where: { active: true, type },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toCatalogProduct);
}

export async function getRelatedProducts(
  product: CatalogProduct,
  limit = 6,
): Promise<CatalogProduct[]> {
  const rows = await db.product.findMany({
    where: { active: true, type: product.type, id: { not: product.id } },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toCatalogProduct);
}

export async function getCategories() {
  const categories = await db.category.findMany({
    where: { products: { some: { active: true } } },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: { where: { active: true } } } } },
  });
  return categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    count: c._count.products,
  }));
}

/** Distinct filter values across the active catalogue. */
export async function getFilterOptions() {
  const variants = await db.productVariant.findMany({
    where: { product: { active: true } },
    select: { color: true, size: true, priceMinor: true },
  });

  const prices = variants.map((v) => v.priceMinor);
  return {
    colors: [...new Set(variants.map((v) => v.color))].sort(),
    sizes: [...new Set(variants.map((v) => v.size))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ),
    minPriceMinor: prices.length > 0 ? Math.min(...prices) : 0,
    maxPriceMinor: prices.length > 0 ? Math.max(...prices) : 0,
  };
}

export { PRODUCT_TYPE_META };
