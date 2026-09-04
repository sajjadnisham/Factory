-- CreateTable
CREATE TABLE "StockFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockFile" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockFolder_name_key" ON "StockFolder"("name");

-- CreateIndex
CREATE INDEX "StockFolder_name_idx" ON "StockFolder"("name");

-- CreateIndex
CREATE INDEX "StockFile_folderId_idx" ON "StockFile"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "StockFile_folderId_name_key" ON "StockFile"("folderId", "name");

-- AddForeignKey
ALTER TABLE "StockFile" ADD CONSTRAINT "StockFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "StockFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

