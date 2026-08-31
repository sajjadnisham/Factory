import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  StorageError,
  type StorageFile,
  type StorageFolder,
  type StorageProvider,
} from "./types";

/**
 * Reads STOCK from the local filesystem. This is the development provider and
 * also a valid production choice when the store owner syncs a folder to the
 * server (Drive desktop client, rclone, a mounted volume).
 *
 * File ids are paths relative to the stock root, base64url-encoded so they are
 * safe in a URL. Encoded ids are resolved back through a containment check —
 * an id that escapes the stock root is rejected rather than read.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "Local filesystem";
  private readonly root: string;

  constructor(rootPath: string) {
    this.root = path.resolve(process.cwd(), rootPath);
  }

  async listProductFolders(): Promise<StorageFolder[]> {
    let entries;
    try {
      entries = await fs.readdir(this.root, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError(
          `STOCK folder not found at ${this.root}. Create it or set LOCAL_STOCK_PATH.`,
          error,
        );
      }
      throw new StorageError(`Could not read STOCK folder: ${this.root}`, error);
    }

    const folders: StorageFolder[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const full = path.join(this.root, entry.name);
      const stat = await fs.stat(full);
      folders.push({
        id: this.encodeId(entry.name),
        name: entry.name,
        modifiedAt: stat.mtime,
      });
    }
    return folders.sort((a, b) => a.name.localeCompare(b.name));
  }

  async listFiles(folderId: string): Promise<StorageFile[]> {
    const dir = this.resolveId(folderId);
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      throw new StorageError(`Could not read product folder: ${folderId}`, error);
    }

    const files: StorageFile[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      const stat = await fs.stat(full);
      const relative = path.relative(this.root, full);
      files.push({
        id: this.encodeId(relative),
        name: entry.name,
        mimeType: mimeTypeFor(entry.name),
        size: stat.size,
        modifiedAt: stat.mtime,
        // Cheap change detection: size + mtime, not a full content hash. The
        // sync service treats this as an opaque token, so swapping in a real
        // checksum later changes nothing downstream.
        checksum: createHash("sha256")
          .update(`${stat.size}:${stat.mtimeMs}`)
          .digest("hex"),
      });
    }
    return files.sort((a, b) => a.name.localeCompare(b.name));
  }

  async readTextFile(fileId: string): Promise<string | null> {
    try {
      return await fs.readFile(this.resolveId(fileId), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new StorageError(`Could not read file: ${fileId}`, error);
    }
  }

  async readFile(fileId: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.resolveId(fileId));
    } catch (error) {
      throw new StorageError(`Could not read file: ${fileId}`, error);
    }
  }

  async getPublicUrl(): Promise<string | null> {
    // Local files are not publicly reachable; images stream via /api/images.
    return null;
  }

  private encodeId(relativePath: string): string {
    return Buffer.from(relativePath, "utf8").toString("base64url");
  }

  private resolveId(id: string): string {
    const relative = Buffer.from(id, "base64url").toString("utf8");
    const resolved = path.resolve(this.root, relative);
    // Path traversal guard: ids arrive from URLs, so never trust them to stay
    // inside the stock root.
    if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
      throw new StorageError(`Rejected storage id outside STOCK root: ${id}`);
    }
    return resolved;
  }
}

function mimeTypeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    case ".json":
      return "application/json";
    case ".txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}
