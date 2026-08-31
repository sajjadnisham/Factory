import { createHash } from "node:crypto";

import { parsePriceToMinor } from "@/lib/money";
import {
  isImageFile,
  MAX_IMAGES_PER_PRODUCT,
  type StorageFile,
  type StorageFolder,
} from "@/lib/storage/types";

import {
  normaliseColor,
  normaliseSize,
  normaliseType,
  productJsonSchema,
  PRODUCT_TYPE_META,
  type ProductType,
} from "./schema";

/**
 * Turns a STOCK folder into a validated product, from either metadata source:
 *
 *   1. product.json inside the folder (preferred), or
 *   2. the folder name itself, using the pipe convention:
 *      TSHIRT | OVERSIZED BASIC | 750 | BLACK | S,M,L,XL,XXL | STOCK:12
 *
 * This module is deliberately free of database and UI imports: it is a pure
 * function of (folder, files, json text). Changing the naming convention means
 * editing this file only.
 */

export interface ParsedVariant {
  size: string;
  color: string;
  priceMinor: number;
  comparePriceMinor: number | null;
  stock: number;
}

export interface ParsedImage {
  sourceFileId: string;
  fileName: string;
  sortOrder: number;
  checksum: string | null;
}

export interface ParsedProduct {
  externalFolderId: string;
  externalFolderName: string;
  sku: string;
  name: string;
  slug: string;
  type: ProductType;
  categorySlug: string;
  categoryLabel: string;
  description: string;
  active: boolean;
  featured: boolean;
  newArrival: boolean;
  variants: ParsedVariant[];
  images: ParsedImage[];
  /** Which metadata source won, shown in the admin product inspector. */
  metadataSource: "product.json" | "folder-name";
  sourceMetadata: Record<string, unknown>;
  /** Changes whenever anything the storefront renders changes. */
  contentHash: string;
}

export interface ParseIssue {
  severity: "error" | "warning";
  message: string;
}

export type ParseResult =
  | { ok: true; product: ParsedProduct; warnings: ParseIssue[] }
  | { ok: false; errors: ParseIssue[]; warnings: ParseIssue[] };

const METADATA_FILE = "product.json";

export function findMetadataFile(files: StorageFile[]): StorageFile | undefined {
  return files.find((f) => f.name.toLowerCase() === METADATA_FILE);
}

export function parseProduct(
  folder: StorageFolder,
  files: StorageFile[],
  metadataText: string | null,
): ParseResult {
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];

  const images = collectImages(files, warnings);
  if (images.length === 0) {
    errors.push({
      severity: "error",
      message: "No product images found. Add at least one JPG or PNG.",
    });
  }

  const metadata = metadataText
    ? parseJsonMetadata(metadataText, errors)
    : parseFolderNameMetadata(folder.name, errors);

  if (!metadata || errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const type = normaliseType(metadata.type);
  if (!type) {
    errors.push({
      severity: "error",
      message: `Unknown product type "${metadata.type}". Use one of: ${Object.keys(PRODUCT_TYPE_META).join(", ")}.`,
    });
    return { ok: false, errors, warnings };
  }

  const priceMinor = parsePriceToMinor(metadata.price);
  if (priceMinor === null || priceMinor <= 0) {
    errors.push({
      severity: "error",
      message: `Invalid price "${String(metadata.price)}". Use a positive number of rufiyaa, e.g. 750.`,
    });
    return { ok: false, errors, warnings };
  }

  const comparePriceMinor =
    metadata.comparePrice !== undefined
      ? parsePriceToMinor(metadata.comparePrice)
      : null;
  if (comparePriceMinor !== null && comparePriceMinor <= priceMinor) {
    warnings.push({
      severity: "warning",
      message:
        "comparePrice is not higher than price, so no discount will be shown.",
    });
  }

  if (metadata.currency && metadata.currency.toUpperCase() !== "MVR") {
    warnings.push({
      severity: "warning",
      message: `Currency "${metadata.currency}" ignored — the store sells in MVR only.`,
    });
  }

  const variants = buildVariants(metadata, priceMinor, comparePriceMinor, errors, warnings);
  if (variants.length === 0) {
    if (errors.length === 0) {
      errors.push({
        severity: "error",
        message: "No sizes found. Add a sizes list, e.g. \"sizes\": [\"S\",\"M\",\"L\"].",
      });
    }
    return { ok: false, errors, warnings };
  }

  // A folder-name product has no SKU field, and its folder name is the whole
  // pipe-delimited string — so derive one from type and name instead.
  const sku = (
    metadata.sku ??
    (metadataText ? folder.name : `${type}-${metadata.name}`)
  )
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!/^[A-Z0-9][A-Z0-9._-]{1,63}$/.test(sku)) {
    errors.push({
      severity: "error",
      message: `Invalid SKU "${sku}". Use letters, numbers, dashes and dots, e.g. TSHIRT-001.`,
    });
    return { ok: false, errors, warnings };
  }

  const typeMeta = PRODUCT_TYPE_META[type];
  const product: ParsedProduct = {
    externalFolderId: folder.id,
    externalFolderName: folder.name,
    sku,
    name: metadata.name.trim(),
    slug: buildSlug(metadata.name, sku),
    type,
    categorySlug: typeMeta.slug,
    categoryLabel: metadata.category?.trim() || typeMeta.label,
    description: metadata.description?.trim() ?? "",
    active: metadata.active ?? true,
    featured: metadata.featured ?? false,
    newArrival: metadata.newArrival ?? false,
    variants,
    images,
    metadataSource: metadataText ? "product.json" : "folder-name",
    sourceMetadata: metadata as unknown as Record<string, unknown>,
    contentHash: "",
  };
  product.contentHash = hashProduct(product);

  return { ok: true, product, warnings };
}

// ---------------------------------------------------------------------------
// Metadata sources
// ---------------------------------------------------------------------------

type Metadata = {
  sku?: string;
  type: string;
  name: string;
  category?: string;
  price: number;
  comparePrice?: number;
  currency?: string;
  colors?: string[];
  sizes?: string[];
  description?: string;
  featured?: boolean;
  newArrival?: boolean;
  active?: boolean;
  stock?: number;
  variants?: { size: string; color?: string; stock: number; price?: number }[];
};

function parseJsonMetadata(text: string, errors: ParseIssue[]): Metadata | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    errors.push({
      severity: "error",
      message:
        "product.json is not valid JSON. A missing comma or quote is the usual cause.",
    });
    return null;
  }

  const result = productJsonSchema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "product.json";
      errors.push({ severity: "error", message: `${field}: ${issue.message}` });
    }
    return null;
  }
  return result.data;
}

/**
 * Folder-name convention, used when a folder has no product.json:
 *
 *   TSHIRT | OVERSIZED BASIC | 750 | BLACK | S,M,L,XL,XXL | STOCK:12
 *
 * Fields after the price are optional and order-independent where they carry a
 * prefix (STOCK:, SKU:), which keeps the convention forgiving to type.
 */
function parseFolderNameMetadata(
  folderName: string,
  errors: ParseIssue[],
): Metadata | null {
  const parts = folderName.split("|").map((p) => p.trim()).filter(Boolean);

  if (parts.length < 3) {
    errors.push({
      severity: "error",
      message:
        `Folder "${folderName}" has no product.json and its name does not follow the convention ` +
        "TYPE | NAME | PRICE | COLOR | SIZES | STOCK:n",
    });
    return null;
  }

  const [type, name, price, ...rest] = parts as [string, string, string, ...string[]];
  const metadata: Metadata = {
    type,
    name,
    price: Number.parseFloat(price.replace(/[^0-9.]/g, "")),
  };

  const looseParts: string[] = [];
  for (const part of rest) {
    const prefixed = /^([A-Za-z]+)\s*:\s*(.+)$/.exec(part);
    if (prefixed) {
      const key = prefixed[1]!.toLowerCase();
      const value = prefixed[2]!.trim();
      if (key === "stock") metadata.stock = Number.parseInt(value, 10);
      else if (key === "sku") metadata.sku = value;
      else if (key === "was") metadata.comparePrice = Number.parseFloat(value);
      else if (key === "sizes") metadata.sizes = splitList(value);
      else if (key === "colors" || key === "color") metadata.colors = splitList(value);
      continue;
    }
    looseParts.push(part);
  }

  // Unprefixed fields: a part containing size tokens is the size list, anything
  // else is a colour list.
  for (const part of looseParts) {
    const values = splitList(part);
    const looksLikeSizes = values.every((v) => /^(XS|S|M|L|XL|XXL|XXXL|\d{2}|ONE SIZE)$/i.test(v));
    if (looksLikeSizes && !metadata.sizes) metadata.sizes = values;
    else if (!metadata.colors) metadata.colors = values;
  }

  if (Number.isNaN(metadata.price)) {
    errors.push({
      severity: "error",
      message: `Could not read a price from folder name "${folderName}".`,
    });
    return null;
  }
  return metadata;
}

function splitList(value: string): string[] {
  return value
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------

function buildVariants(
  metadata: Metadata,
  priceMinor: number,
  comparePriceMinor: number | null,
  errors: ParseIssue[],
  warnings: ParseIssue[],
): ParsedVariant[] {
  const colors = (metadata.colors ?? []).map(normaliseColor).filter(Boolean);
  const fallbackColor = colors[0] ?? "Default";

  // Explicit variants win: they are the only way to express different stock
  // per size or colour.
  if (metadata.variants && metadata.variants.length > 0) {
    const seen = new Set<string>();
    const variants: ParsedVariant[] = [];
    for (const v of metadata.variants) {
      const size = normaliseSize(v.size);
      const color = normaliseColor(v.color ?? fallbackColor);
      const key = `${size}::${color}`;
      if (seen.has(key)) {
        warnings.push({
          severity: "warning",
          message: `Duplicate variant ${size}/${color} ignored.`,
        });
        continue;
      }
      seen.add(key);

      const variantPrice =
        v.price !== undefined ? parsePriceToMinor(v.price) : priceMinor;
      if (variantPrice === null || variantPrice <= 0) {
        errors.push({
          severity: "error",
          message: `Variant ${size}/${color} has an invalid price.`,
        });
        continue;
      }
      variants.push({
        size,
        color,
        priceMinor: variantPrice,
        comparePriceMinor,
        stock: v.stock,
      });
    }
    return variants;
  }

  const sizes = (metadata.sizes ?? []).map(normaliseSize).filter(Boolean);
  if (sizes.length === 0) return [];

  const colorList = colors.length > 0 ? colors : [fallbackColor];
  const totalStock = metadata.stock ?? 0;

  if (metadata.stock === undefined) {
    warnings.push({
      severity: "warning",
      message: "No stock given, so the product syncs as out of stock.",
    });
  }

  // A single stock number spreads across the size × colour grid. Any remainder
  // goes to the earliest variants rather than being silently dropped.
  const cells = sizes.length * colorList.length;
  const base = Math.floor(totalStock / cells);
  let remainder = totalStock % cells;

  const variants: ParsedVariant[] = [];
  for (const color of colorList) {
    for (const size of sizes) {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      variants.push({
        size,
        color,
        priceMinor,
        comparePriceMinor,
        stock: base + extra,
      });
    }
  }
  return variants;
}

function collectImages(
  files: StorageFile[],
  warnings: ParseIssue[],
): ParsedImage[] {
  const nonImages = files.filter(
    (f) => !isImageFile(f) && f.name.toLowerCase() !== METADATA_FILE,
  );
  for (const file of nonImages) {
    warnings.push({
      severity: "warning",
      message: `Ignored unsupported file "${file.name}".`,
    });
  }

  // Numeric-prefixed names (01.jpg, 02.jpg) define display order; that is the
  // convention the store owner is told to follow.
  const images = files
    .filter(isImageFile)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (images.length > MAX_IMAGES_PER_PRODUCT) {
    warnings.push({
      severity: "warning",
      message: `Folder has ${images.length} images; only the first ${MAX_IMAGES_PER_PRODUCT} are used.`,
    });
  }

  return images.slice(0, MAX_IMAGES_PER_PRODUCT).map((file, index) => ({
    sourceFileId: file.id,
    fileName: file.name,
    sortOrder: index,
    checksum: file.checksum,
  }));
}

export function buildSlug(name: string, sku: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  const suffix = sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  // The SKU suffix keeps URLs unique when two products share a name.
  return base ? `${base}-${suffix}` : suffix;
}

function hashProduct(product: ParsedProduct): string {
  const material = JSON.stringify({
    sku: product.sku,
    name: product.name,
    type: product.type,
    category: product.categoryLabel,
    description: product.description,
    active: product.active,
    featured: product.featured,
    newArrival: product.newArrival,
    variants: product.variants.map((v) => [
      v.size,
      v.color,
      v.priceMinor,
      v.comparePriceMinor,
    ]),
    images: product.images.map((i) => [i.sourceFileId, i.sortOrder, i.checksum]),
  });
  return createHash("sha256").update(material).digest("hex");
}
