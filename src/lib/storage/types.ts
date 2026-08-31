/**
 * Storage abstraction for the STOCK folder.
 *
 * The application never talks to Google Drive (or any other provider) directly.
 * Everything goes through this interface so the provider can be swapped —
 * local filesystem in development, Drive in production, object storage later —
 * without touching the parser, the sync service or any UI code.
 */

export interface StorageFolder {
  /** Provider-stable id. On Drive this survives a rename; locally it is the path. */
  id: string;
  name: string;
  modifiedAt: Date | null;
}

export interface StorageFile {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedAt: Date | null;
  /** Provider checksum when available; used to detect changed images. */
  checksum: string | null;
}

export interface StorageProvider {
  /** Human-readable name, shown in the admin sync report. */
  readonly name: string;

  /** Immediate subfolders of STOCK — one per product. */
  listProductFolders(): Promise<StorageFolder[]>;

  /** Files directly inside one product folder. */
  listFiles(folderId: string): Promise<StorageFile[]>;

  /** Reads a small text file (product.json). Returns null when absent. */
  readTextFile(fileId: string): Promise<string | null>;

  /** Streams a file's bytes, for serving product images. */
  readFile(fileId: string): Promise<Buffer>;

  /**
   * Publicly reachable URL for a file, when the provider has one. Returning
   * null makes the app serve the image through its own /api/images/[id] route,
   * which is the correct behaviour for a private Drive folder.
   */
  getPublicUrl(fileId: string): Promise<string | null>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export const MAX_IMAGES_PER_PRODUCT = 5;

export function isImageFile(file: StorageFile): boolean {
  if (IMAGE_MIME_TYPES.has(file.mimeType.toLowerCase())) return true;
  return /\.(jpe?g|png|webp|avif)$/i.test(file.name);
}
