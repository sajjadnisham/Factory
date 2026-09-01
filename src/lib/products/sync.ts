import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getStorageProvider } from "@/lib/storage";
import type { StorageFile, StorageFolder } from "@/lib/storage/types";

import {
  findMetadataFile,
  parseProduct,
  type ParsedProduct,
  type ParseIssue,
} from "./parser";
import { PRODUCT_TYPE_META, type ProductType } from "./schema";

/**
 * Synchronises the STOCK folder into the database.
 *
 * Guarantees that matter:
 *   * One bad folder never blocks the rest — every product is parsed and
 *     written inside its own try/catch, and failures land in ProductSyncIssue.
 *   * Sync owns product *content* only. Stock is applied as a delta against
 *     `syncedStock`, so units sold between syncs are not resurrected.
 *   * A folder that disappears deactivates its product rather than deleting it,
 *     because past orders reference it.
 */

export interface SyncReport {
  runId: string;
  productsFound: number;
  productsNew: number;
  productsUpdated: number;
  productsRemoved: number;
  imagesUpdated: number;
  invalidProducts: number;
  durationMs: number;
  issues: {
    folderName: string;
    sku: string | null;
    severity: string;
    message: string;
  }[];
}

export async function syncStock(
  options: { triggeredBy?: string } = {},
): Promise<SyncReport> {
  const startedAt = Date.now();
  const run = await db.syncRun.create({
    data: { triggeredBy: options.triggeredBy ?? "cli", status: "running" },
  });

  const report: SyncReport = {
    runId: run.id,
    productsFound: 0,
    productsNew: 0,
    productsUpdated: 0,
    productsRemoved: 0,
    imagesUpdated: 0,
    invalidProducts: 0,
    durationMs: 0,
    issues: [],
  };

  const recordIssue = async (
    folder: { id: string; name: string },
    sku: string | null,
    issue: ParseIssue,
  ) => {
    report.issues.push({
      folderName: folder.name,
      sku,
      severity: issue.severity,
      message: issue.message,
    });
    await db.productSyncIssue.create({
      data: {
        externalFolderId: folder.id,
        folderName: folder.name,
        sku,
        severity: issue.severity,
        message: issue.message,
        syncRunId: run.id,
      },
    });
  };

  try {
    const storage = getStorageProvider();
    const folders = await storage.listProductFolders();
    report.productsFound = folders.length;

    const seenFolderIds: string[] = [];
    const seenSkus = new Map<string, string>(); // sku -> folder name

    for (const folder of folders) {
      try {
        const files = await storage.listFiles(folder.id);
        const metadataFile = findMetadataFile(files);
        const metadataText = metadataFile
          ? await storage.readTextFile(metadataFile.id)
          : null;

        const result = parseProduct(folder, files, metadataText);

        for (const warning of result.warnings) {
          await recordIssue(folder, null, warning);
        }

        if (!result.ok) {
          report.invalidProducts += 1;
          for (const error of result.errors) {
            await recordIssue(folder, null, error);
          }
          continue;
        }

        const product = result.product;

        // Duplicate SKUs would collide on the unique index; report rather than
        // letting the second folder throw.
        const previousFolder = seenSkus.get(product.sku);
        if (previousFolder) {
          report.invalidProducts += 1;
          await recordIssue(folder, product.sku, {
            severity: "error",
            message: `Duplicate SKU "${product.sku}" — already used by folder "${previousFolder}".`,
          });
          continue;
        }
        seenSkus.set(product.sku, folder.name);
        seenFolderIds.push(folder.id);

        const outcome = await upsertProduct(product);
        if (outcome.created) report.productsNew += 1;
        else if (outcome.changed) report.productsUpdated += 1;
        report.imagesUpdated += outcome.imagesUpdated;
      } catch (error) {
        // A provider hiccup on one folder must not abort the whole run.
        report.invalidProducts += 1;
        await recordIssue(folder, null, {
          severity: "error",
          message: `Could not sync folder: ${errorMessage(error)}`,
        });
      }
    }

    // A scan that returned nothing is far more likely to be a provider fault (a
    // transient API error, a folder id that changed, revoked sharing) than the
    // owner emptying their entire STOCK folder. Deactivating on that signal
    // would blank the storefront, so it is refused and reported instead.
    if (folders.length === 0) {
      const activeProducts = await db.product.count({ where: { active: true } });
      if (activeProducts > 0) {
        await recordIssue(
          { id: "", name: "STOCK" },
          null,
          {
            severity: "error",
            message:
              `STOCK returned no product folders while ${activeProducts} product(s) are live. ` +
              "Nothing was deactivated — check the folder id and sharing permissions, then sync again.",
          },
        );
        report.invalidProducts += 1;
      }
    } else {
      report.productsRemoved = await deactivateMissingProducts(seenFolderIds);
    }

    report.durationMs = Date.now() - startedAt;
    await db.syncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        productsFound: report.productsFound,
        productsNew: report.productsNew,
        productsUpdated: report.productsUpdated,
        productsRemoved: report.productsRemoved,
        imagesUpdated: report.imagesUpdated,
        invalidProducts: report.invalidProducts,
      },
    });
    return report;
  } catch (error) {
    // Reaching here means the provider itself failed (bad credentials, missing
    // STOCK folder). The catalogue already in the database is left untouched.
    report.durationMs = Date.now() - startedAt;
    await db.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: errorMessage(error),
      },
    });
    throw error;
  }
}

interface UpsertOutcome {
  created: boolean;
  changed: boolean;
  imagesUpdated: number;
}

async function upsertProduct(parsed: ParsedProduct): Promise<UpsertOutcome> {
  const category = await ensureCategory(parsed.type, parsed.categoryLabel);

  return db.$transaction(async (tx) => {
    // Match on folder id first so a renamed folder updates in place; fall back
    // to SKU so a folder recreated with the same SKU reuses the product.
    const existing =
      (await tx.product.findUnique({
        where: { externalFolderId: parsed.externalFolderId },
        include: { variants: true, images: true },
      })) ??
      (await tx.product.findUnique({
        where: { sku: parsed.sku },
        include: { variants: true, images: true },
      }));

    if (existing && existing.contentHash === parsed.contentHash && existing.active === parsed.active) {
      return { created: false, changed: false, imagesUpdated: 0 };
    }

    // Denormalised so the storefront can sort and filter by price in SQL.
    const prices = parsed.variants.map((v) => v.priceMinor);

    const data = {
      externalFolderId: parsed.externalFolderId,
      externalFolderName: parsed.externalFolderName,
      sku: parsed.sku,
      name: parsed.name,
      slug: parsed.slug,
      type: parsed.type,
      description: parsed.description,
      active: parsed.active,
      featured: parsed.featured,
      newArrival: parsed.newArrival,
      categoryId: category.id,
      minPriceMinor: Math.min(...prices),
      maxPriceMinor: Math.max(...prices),
      sourceMetadata: parsed.sourceMetadata as Prisma.InputJsonValue,
      contentHash: parsed.contentHash,
    };

    const product = existing
      ? await tx.product.update({ where: { id: existing.id }, data })
      : await tx.product.create({ data });

    const imagesUpdated = await syncImages(tx, product.id, parsed, existing?.images ?? []);
    await syncVariants(tx, product.id, parsed, existing?.variants ?? []);

    return { created: !existing, changed: Boolean(existing), imagesUpdated };
  });
}

type Tx = Prisma.TransactionClient;

async function syncImages(
  tx: Tx,
  productId: string,
  parsed: ParsedProduct,
  existing: { id: string; sourceFileId: string; contentHash: string | null; sortOrder: number }[],
): Promise<number> {
  const byFileId = new Map(existing.map((i) => [i.sourceFileId, i]));
  let updated = 0;

  for (const image of parsed.images) {
    const current = byFileId.get(image.sourceFileId);
    if (!current) {
      await tx.productImage.create({
        data: {
          productId,
          sourceFileId: image.sourceFileId,
          fileName: image.fileName,
          sortOrder: image.sortOrder,
          contentHash: image.checksum,
        },
      });
      updated += 1;
      continue;
    }
    if (
      current.contentHash !== image.checksum ||
      current.sortOrder !== image.sortOrder
    ) {
      await tx.productImage.update({
        where: { id: current.id },
        data: { sortOrder: image.sortOrder, contentHash: image.checksum, fileName: image.fileName },
      });
      updated += 1;
    }
    byFileId.delete(image.sourceFileId);
  }

  // Whatever is left was removed from the folder.
  const removedIds = [...byFileId.values()].map((i) => i.id);
  if (removedIds.length > 0) {
    await tx.productImage.deleteMany({ where: { id: { in: removedIds } } });
    updated += removedIds.length;
  }
  return updated;
}

async function syncVariants(
  tx: Tx,
  productId: string,
  parsed: ParsedProduct,
  existing: {
    id: string;
    size: string;
    color: string;
    stock: number;
    syncedStock: number;
  }[],
): Promise<void> {
  const byKey = new Map(existing.map((v) => [`${v.size}::${v.color}`, v]));

  for (const variant of parsed.variants) {
    const key = `${variant.size}::${variant.color}`;
    const current = byKey.get(key);

    if (!current) {
      const created = await tx.productVariant.create({
        data: {
          productId,
          size: variant.size,
          color: variant.color,
          priceMinor: variant.priceMinor,
          comparePriceMinor: variant.comparePriceMinor,
          stock: variant.stock,
          syncedStock: variant.stock,
        },
      });
      await tx.inventoryTransaction.create({
        data: {
          variantId: created.id,
          kind: "sync_set",
          quantity: variant.stock,
          stockAfter: variant.stock,
          note: "Initial stock from STOCK folder",
        },
      });
      continue;
    }

    // Apply the change the owner made in the folder, not the absolute number:
    // folder says 12 -> 20 means "+8", even if 3 have been sold since.
    const delta = variant.stock - current.syncedStock;
    const newStock = Math.max(0, current.stock + delta);

    await tx.productVariant.update({
      where: { id: current.id },
      data: {
        priceMinor: variant.priceMinor,
        comparePriceMinor: variant.comparePriceMinor,
        stock: newStock,
        syncedStock: variant.stock,
      },
    });

    if (delta !== 0) {
      await tx.inventoryTransaction.create({
        data: {
          variantId: current.id,
          kind: "sync_set",
          quantity: delta,
          stockAfter: newStock,
          note: `STOCK folder changed declared stock from ${current.syncedStock} to ${variant.stock}`,
        },
      });
    }
    byKey.delete(key);
  }

  // Variants no longer offered are zeroed rather than deleted, because order
  // items point at them.
  for (const stale of byKey.values()) {
    await tx.productVariant.update({
      where: { id: stale.id },
      data: { stock: 0, syncedStock: 0 },
    });
  }
}

async function ensureCategory(type: ProductType, label: string) {
  const meta = PRODUCT_TYPE_META[type];
  return db.category.upsert({
    where: { slug: meta.slug },
    update: {},
    create: { slug: meta.slug, name: label || meta.label, sortOrder: meta.sortOrder },
  });
}

/**
 * Deactivates products whose folder is gone. Only ever called with a non-empty
 * list — see the empty-scan guard in syncStock, which is what stops a failed
 * listing from emptying the storefront.
 */
async function deactivateMissingProducts(seenFolderIds: string[]): Promise<number> {
  if (seenFolderIds.length === 0) return 0;

  const result = await db.product.updateMany({
    where: { active: true, externalFolderId: { notIn: seenFolderIds } },
    data: { active: false },
  });
  return result.count;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Formats a report the way the brief specifies for the admin panel. */
export function formatSyncReport(report: SyncReport): string {
  return [
    "Scanning Stock Folder...",
    `Products Found: ${report.productsFound}`,
    `New: ${report.productsNew}`,
    `Updated: ${report.productsUpdated}`,
    `Removed: ${report.productsRemoved}`,
    `Images Updated: ${report.imagesUpdated}`,
    `Invalid Products: ${report.invalidProducts}`,
    "SYNC COMPLETE",
  ].join("\n");
}
