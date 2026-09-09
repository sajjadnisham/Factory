import { createHash } from "node:crypto";

import { db } from "@/lib/db";

/**
 * Brand artwork the store owner uploads: the wordmark and the hero roundel.
 *
 * Both have hand-drawn SVG fallbacks (factory-logo.tsx, factory-badge.tsx) so a
 * fresh install is never unbranded. Uploading a file replaces the drawing
 * wherever that slot appears; removing it puts the drawing back.
 *
 * The bytes live in Postgres rather than on disk because a container on a free
 * plan has no persistent filesystem — anything written to ./public is gone on
 * the next deploy and on every wake from sleep.
 */

export const BRAND_SLOTS = {
  logo: "Wordmark — header and footer",
  badge: "Roundel — homepage hero",
} as const;

export type BrandSlot = keyof typeof BRAND_SLOTS;

export const MAX_BRAND_BYTES = 2 * 1024 * 1024;

export const BRAND_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export function isBrandSlot(value: string): value is BrandSlot {
  return Object.prototype.hasOwnProperty.call(BRAND_SLOTS, value);
}

export interface BrandAssetMeta {
  key: BrandSlot;
  mimeType: string;
  size: number;
  checksum: string;
  updatedAt: Date;
}

/**
 * Which slots have artwork, without loading any of it.
 *
 * Deliberately never selects `bytes`: this runs on every storefront render, and
 * pulling two images into memory to decide whether to draw an <img> would be a
 * good way to exhaust a 512MB instance.
 */
export async function getBrandAssets(): Promise<Partial<Record<BrandSlot, BrandAssetMeta>>> {
  let rows;
  try {
    rows = await db.brandAsset.findMany({
      select: { key: true, mimeType: true, size: true, checksum: true, updatedAt: true },
    });
  } catch (error) {
    // Presentation must never depend on the database being reachable — the
    // same reason getSettings() falls back. The drawn marks are used instead.
    console.warn(
      "[brand] falling back to the drawn marks:",
      error instanceof Error ? error.message : error,
    );
    return {};
  }

  const out: Partial<Record<BrandSlot, BrandAssetMeta>> = {};
  for (const row of rows) {
    if (isBrandSlot(row.key)) out[row.key] = { ...row, key: row.key };
  }
  return out;
}

export async function readBrandAsset(
  key: BrandSlot,
): Promise<{ bytes: Buffer; mimeType: string; checksum: string } | null> {
  const row = await db.brandAsset.findUnique({
    where: { key },
    select: { bytes: true, mimeType: true, checksum: true },
  });
  if (!row) return null;
  return { bytes: Buffer.from(row.bytes), mimeType: row.mimeType, checksum: row.checksum };
}

export function validateBrandUpload(file: {
  mimeType: string;
  byteLength: number;
}): string | null {
  if (!BRAND_MIME_TYPES.has(file.mimeType.toLowerCase())) {
    return `That is ${file.mimeType || "an unknown file type"}. Use PNG, JPG, WebP or SVG.`;
  }
  if (file.byteLength > MAX_BRAND_BYTES) {
    return `That file is ${(file.byteLength / 1024 / 1024).toFixed(1)}MB. The limit is ${MAX_BRAND_BYTES / 1024 / 1024}MB.`;
  }
  if (file.byteLength === 0) return "That file is empty.";
  return null;
}

export async function saveBrandAsset(
  key: BrandSlot,
  file: { mimeType: string; bytes: Buffer },
): Promise<void> {
  const checksum = createHash("sha256").update(file.bytes).digest("hex");
  const data = {
    mimeType: file.mimeType.toLowerCase(),
    size: file.bytes.byteLength,
    checksum,
    // Prisma's Bytes column takes a Uint8Array; a Buffer is one, but its
    // ArrayBufferLike backing does not satisfy the generated type.
    bytes: new Uint8Array(file.bytes),
  };
  await db.brandAsset.upsert({ where: { key }, create: { key, ...data }, update: data });
}

export async function deleteBrandAsset(key: BrandSlot): Promise<boolean> {
  const result = await db.brandAsset.deleteMany({ where: { key } });
  return result.count > 0;
}
