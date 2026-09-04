import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import { IMAGE_MIME_TYPES, MAX_IMAGES_PER_PRODUCT } from "@/lib/storage/types";

/**
 * Writes a product into the uploaded-STOCK tables.
 *
 * This is the only writer. It produces exactly what a store owner would have
 * created by hand in a STOCK folder — a folder named after the SKU, a
 * product.json, and images named 01.jpg, 02.png … in display order — so the
 * parser and sync service handle an uploaded product through the same path as
 * a Drive one, and neither of them needed changing to support uploads.
 *
 * It does not validate the metadata itself. The parser owns those rules, and
 * duplicating them here would be two sources of truth for what a valid product
 * is; the caller runs a sync straight afterwards and surfaces what it reports.
 */

/** Per-image ceiling. A 512MB instance holds the whole upload in memory. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export interface UploadImage {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface UploadIssue {
  message: string;
}

export type SaveResult =
  | { ok: true; folderName: string; imagesStored: number }
  | { ok: false; errors: UploadIssue[] };

/** File extension for a browser-supplied MIME type, defaulting to jpg. */
function extensionFor(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    default:
      return "jpg";
  }
}

export function validateImages(images: UploadImage[]): UploadIssue[] {
  const errors: UploadIssue[] = [];

  if (images.length === 0) {
    errors.push({ message: "Add at least one photo — a product with no image is skipped by sync." });
  }

  if (images.length > MAX_IMAGES_PER_PRODUCT) {
    errors.push({
      message: `${images.length} photos selected; the maximum is ${MAX_IMAGES_PER_PRODUCT}.`,
    });
  }

  for (const image of images) {
    if (!IMAGE_MIME_TYPES.has(image.mimeType.toLowerCase())) {
      errors.push({
        message: `"${image.fileName}" is ${image.mimeType || "an unknown type"}. Use JPG, PNG, WebP or AVIF.`,
      });
    }
    if (image.bytes.byteLength > MAX_IMAGE_BYTES) {
      errors.push({
        message: `"${image.fileName}" is ${(image.bytes.byteLength / 1024 / 1024).toFixed(1)}MB. The limit is ${MAX_IMAGE_BYTES / 1024 / 1024}MB per photo.`,
      });
    }
  }

  return errors;
}

/**
 * Creates or replaces one uploaded product folder.
 *
 * Replacing is a delete-then-write inside a transaction rather than a merge,
 * so re-uploading a SKU cannot leave a stale sixth image behind. Deleting the
 * StockFolder row does not touch the catalogue: sync deactivates a product
 * whose folder has gone, and order history keeps its own copies of everything
 * it needs.
 */
export async function saveUploadedProduct(input: {
  folderName: string;
  productJson: unknown;
  images: UploadImage[];
}): Promise<SaveResult> {
  const errors = validateImages(input.images);
  if (errors.length > 0) return { ok: false, errors };

  const folderName = input.folderName.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._\- ]{1,63}$/.test(folderName)) {
    return {
      ok: false,
      errors: [{ message: `"${folderName}" is not a usable folder name. Use letters, numbers, dashes and dots.` }],
    };
  }

  const json = Buffer.from(JSON.stringify(input.productJson, null, 2), "utf8");

  await db.$transaction(async (tx) => {
    await tx.stockFolder.deleteMany({ where: { name: folderName } });

    const folder = await tx.stockFolder.create({ data: { name: folderName } });

    const files = [
      {
        folderId: folder.id,
        name: "product.json",
        mimeType: "application/json",
        size: json.byteLength,
        checksum: createHash("sha256").update(json).digest("hex"),
        // Prisma's Bytes column takes a Uint8Array; a Node Buffer is one, but
        // its ArrayBufferLike backing does not satisfy the generated type.
        bytes: new Uint8Array(json),
      },
      ...input.images.map((image, index) => ({
        folderId: folder.id,
        // Numeric names in upload order: that is how the parser decides which
        // photo is the card image.
        name: `${String(index + 1).padStart(2, "0")}.${extensionFor(image.mimeType)}`,
        mimeType: image.mimeType.toLowerCase(),
        size: image.bytes.byteLength,
        checksum: createHash("sha256").update(image.bytes).digest("hex"),
        bytes: new Uint8Array(image.bytes),
      })),
    ];

    await tx.stockFile.createMany({ data: files });
  });

  return { ok: true, folderName, imagesStored: input.images.length };
}

/** Removes an uploaded folder. Sync then deactivates the product it fed. */
export async function deleteUploadedProduct(folderName: string): Promise<boolean> {
  const result = await db.stockFolder.deleteMany({ where: { name: folderName } });
  return result.count > 0;
}

/** Folder listing for the admin, with sizes but never the image bytes. */
export async function listUploadedProducts(): Promise<
  { name: string; fileCount: number; totalBytes: number; modifiedAt: Date }[]
> {
  const folders = await db.stockFolder.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      modifiedAt: true,
      files: { select: { size: true } },
    },
  });

  return folders.map((folder) => ({
    name: folder.name,
    fileCount: folder.files.length,
    totalBytes: folder.files.reduce((sum, f) => sum + f.size, 0),
    modifiedAt: folder.modifiedAt,
  }));
}
