import { db } from "@/lib/db";

import {
  StorageError,
  type StorageFile,
  type StorageFolder,
  type StorageProvider,
} from "./types";

/**
 * Serves STOCK out of Postgres, for products uploaded through the admin.
 *
 * The other two providers assume the store owner has somewhere to put files —
 * a disk, a Drive account. A container on a free plan has neither: its
 * filesystem is rebuilt on every deploy and every wake from sleep, so anything
 * written to ./stock is gone by the next visitor. The database is the only
 * durable, writable thing such an instance has, so that is where uploads go.
 *
 * Nothing downstream knows. The parser, the sync service and the image route
 * see the same five methods they see from the filesystem, so an uploaded
 * product and a Drive product are validated and ingested identically.
 *
 * Image bytes are deliberately never selected unless they are being served —
 * a listing that pulled every image into memory would be a good way to exhaust
 * a 512MB instance.
 */
export class DbStorageProvider implements StorageProvider {
  readonly name = "Database (admin uploads)";

  async listProductFolders(): Promise<StorageFolder[]> {
    const folders = await db.stockFolder.findMany({
      select: { id: true, name: true, modifiedAt: true },
      orderBy: { name: "asc" },
    });

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      modifiedAt: folder.modifiedAt,
    }));
  }

  async listFiles(folderId: string): Promise<StorageFile[]> {
    const files = await db.stockFile.findMany({
      where: { folderId },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        checksum: true,
        modifiedAt: true,
      },
      orderBy: { name: "asc" },
    });

    return files.map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      modifiedAt: file.modifiedAt,
      checksum: file.checksum,
    }));
  }

  async readTextFile(fileId: string): Promise<string | null> {
    const file = await db.stockFile.findUnique({
      where: { id: fileId },
      select: { bytes: true },
    });
    if (!file) return null;
    return Buffer.from(file.bytes).toString("utf8");
  }

  async readFile(fileId: string): Promise<Buffer> {
    const file = await db.stockFile.findUnique({
      where: { id: fileId },
      select: { bytes: true },
    });
    if (!file) throw new StorageError(`No uploaded file with id ${fileId}`);
    return Buffer.from(file.bytes);
  }

  async getPublicUrl(): Promise<string | null> {
    // Rows in a private database are not publicly reachable; images stream
    // through /api/images.
    return null;
  }
}
