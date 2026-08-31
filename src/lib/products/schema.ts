import { z } from "zod";

/**
 * Validation rules for STOCK product metadata.
 *
 * These are deliberately forgiving about *shape* (a store owner may write
 * `"price": "750"` or `750`) and strict about *meaning* (a negative price or an
 * unknown size is always an error). Anything rejected here is reported in the
 * admin sync results rather than crashing the catalogue.
 */

export const KNOWN_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "28",
  "30",
  "32",
  "34",
  "36",
  "38",
  "40",
  "42",
  "44",
  "ONE SIZE",
] as const;

export const PRODUCT_TYPES = [
  "tshirt",
  "pants",
  "shirt",
  "shorts",
  "hoodie",
  "jacket",
  "accessory",
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

/** Display names and URL slugs per type; drives the category pages. */
export const PRODUCT_TYPE_META: Record<
  ProductType,
  { label: string; slug: string; sortOrder: number }
> = {
  tshirt: { label: "T-Shirts", slug: "t-shirts", sortOrder: 1 },
  pants: { label: "Pants", slug: "pants", sortOrder: 2 },
  shirt: { label: "Shirts", slug: "shirts", sortOrder: 3 },
  shorts: { label: "Shorts", slug: "shorts", sortOrder: 4 },
  hoodie: { label: "Hoodies", slug: "hoodies", sortOrder: 5 },
  jacket: { label: "Jackets", slug: "jackets", sortOrder: 6 },
  accessory: { label: "Accessories", slug: "accessories", sortOrder: 7 },
};

/** Accepts the spellings a store owner is likely to type. */
const TYPE_ALIASES: Record<string, ProductType> = {
  tshirt: "tshirt",
  "t-shirt": "tshirt",
  "t shirt": "tshirt",
  tee: "tshirt",
  tees: "tshirt",
  tshirts: "tshirt",
  pants: "pants",
  pant: "pants",
  trouser: "pants",
  trousers: "pants",
  jeans: "pants",
  shirt: "shirt",
  shirts: "shirt",
  shorts: "shorts",
  short: "shorts",
  hoodie: "hoodie",
  hoodies: "hoodie",
  sweatshirt: "hoodie",
  jacket: "jacket",
  jackets: "jacket",
  accessory: "accessory",
  accessories: "accessory",
  cap: "accessory",
  belt: "accessory",
};

export function normaliseType(input: string): ProductType | null {
  const key = input.trim().toLowerCase().replace(/_/g, "-");
  return TYPE_ALIASES[key] ?? TYPE_ALIASES[key.replace(/-/g, "")] ?? null;
}

export function normaliseSize(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, " ");
}

export function normaliseColor(input: string): string {
  // Title case: "dark BLUE" -> "Dark Blue"
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const flexibleNumber = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number.parseFloat(v.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be a number" });
    return z.NEVER;
  }
  return n;
});

const flexibleBoolean = z
  .union([z.boolean(), z.string(), z.number()])
  .transform((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    return ["true", "yes", "y", "1"].includes(v.trim().toLowerCase());
  });

const stringList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) =>
    (Array.isArray(v) ? v : v.split(","))
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

const variantSchema = z.object({
  size: z.string().min(1),
  color: z.string().min(1).optional(),
  stock: flexibleNumber.pipe(z.number().int().min(0)),
  price: flexibleNumber.pipe(z.number().min(0)).optional(),
});

/**
 * The product.json contract. Unknown keys are allowed so the store owner can
 * keep private notes in the file without breaking the sync.
 */
export const productJsonSchema = z.object({
  sku: z.string().trim().min(1).max(64).optional(),
  type: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().optional(),
  price: flexibleNumber.pipe(z.number().min(0)),
  comparePrice: flexibleNumber.pipe(z.number().min(0)).optional(),
  currency: z.string().trim().optional(),
  colors: stringList.optional(),
  sizes: stringList.optional(),
  description: z.string().trim().max(4000).optional(),
  featured: flexibleBoolean.optional(),
  newArrival: flexibleBoolean.optional(),
  active: flexibleBoolean.optional(),
  stock: flexibleNumber.pipe(z.number().int().min(0)).optional(),
  variants: z.array(variantSchema).optional(),
});

export type ProductJson = z.infer<typeof productJsonSchema>;
