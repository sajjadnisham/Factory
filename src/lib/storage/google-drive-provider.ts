import { google, type drive_v3 } from "googleapis";

import {
  StorageError,
  type StorageFile,
  type StorageFolder,
  type StorageProvider,
} from "./types";

const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface GoogleDriveConfig {
  stockFolderId: string;
  serviceAccountEmail: string;
  privateKey: string;
}

/**
 * Reads STOCK through the official Google Drive API v3 — no scraping.
 *
 * Access is least-privilege: a service account with the read-only Drive scope,
 * and the store owner shares only the STOCK folder with it as Viewer. The
 * service account therefore cannot see, let alone modify, anything else in the
 * owner's Drive.
 */
export class GoogleDriveStorageProvider implements StorageProvider {
  readonly name = "Google Drive";
  private client: drive_v3.Drive | null = null;

  constructor(private readonly config: GoogleDriveConfig) {}

  private drive(): drive_v3.Drive {
    if (this.client) return this.client;

    const auth = new google.auth.JWT({
      email: this.config.serviceAccountEmail,
      // Keys pasted into .env carry literal backslash-n rather than newlines.
      key: this.config.privateKey.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    this.client = google.drive({ version: "v3", auth });
    return this.client;
  }

  async listProductFolders(): Promise<StorageFolder[]> {
    const files = await this.listChildren(
      this.config.stockFolderId,
      `mimeType = '${FOLDER_MIME}'`,
    );
    return files
      .map((f) => ({
        id: f.id ?? "",
        name: f.name ?? "",
        modifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : null,
      }))
      .filter((f) => f.id !== "" && f.name !== "")
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listFiles(folderId: string): Promise<StorageFile[]> {
    const files = await this.listChildren(
      folderId,
      `mimeType != '${FOLDER_MIME}'`,
    );
    return files
      .map((f) => ({
        id: f.id ?? "",
        name: f.name ?? "",
        mimeType: f.mimeType ?? "application/octet-stream",
        size: f.size ? Number(f.size) : null,
        modifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : null,
        // Drive's own MD5 is the change signal for images — no download needed
        // to know whether a picture was replaced.
        checksum: f.md5Checksum ?? f.modifiedTime ?? null,
      }))
      .filter((f) => f.id !== "")
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async readTextFile(fileId: string): Promise<string | null> {
    try {
      const res = await this.drive().files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "text" },
      );
      return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw new StorageError(`Drive: could not read file ${fileId}`, error);
    }
  }

  async readFile(fileId: string): Promise<Buffer> {
    try {
      const res = await this.drive().files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" },
      );
      return Buffer.from(res.data as ArrayBuffer);
    } catch (error) {
      throw new StorageError(`Drive: could not download file ${fileId}`, error);
    }
  }

  async getPublicUrl(): Promise<string | null> {
    // The STOCK folder is private by design, so images are proxied by the app
    // rather than hot-linked from Drive.
    return null;
  }

  private async listChildren(
    parentId: string,
    extraQuery: string,
  ): Promise<drive_v3.Schema$File[]> {
    const out: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const res = await this.drive().files.list({
          q: `'${parentId}' in parents and trashed = false and ${extraQuery}`,
          fields:
            "nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum)",
          pageSize: 200,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          orderBy: "name",
        });
        out.push(...(res.data.files ?? []));
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (error) {
      if (isNotFound(error)) {
        throw new StorageError(
          `Drive folder ${parentId} not found, or it has not been shared with ${this.config.serviceAccountEmail}.`,
          error,
        );
      }
      throw new StorageError(`Drive: could not list folder ${parentId}`, error);
    }

    return out;
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 404
  );
}
