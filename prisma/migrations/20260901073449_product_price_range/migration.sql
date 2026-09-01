-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "maxPriceMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minPriceMinor" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Product_active_minPriceMinor_idx" ON "Product"("active", "minPriceMinor");

-- Backfill from existing variants. Without this, products whose STOCK content
-- has not changed would keep 0 for both columns: the sync service skips
-- unchanged products by content hash, so it would never rewrite these rows.
UPDATE "Product" p
SET "minPriceMinor" = v.lo,
    "maxPriceMinor" = v.hi
FROM (
  SELECT "productId", MIN("priceMinor") AS lo, MAX("priceMinor") AS hi
  FROM "ProductVariant"
  GROUP BY "productId"
) v
WHERE v."productId" = p.id;
