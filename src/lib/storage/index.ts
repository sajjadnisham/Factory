import { env } from "@/lib/env";

import { GoogleDriveStorageProvider } from "./google-drive-provider";
import { LocalStorageProvider } from "./local-provider";
import type { StorageProvider } from "./types";

export * from "./types";

let cached: StorageProvider | null = null;

/**
 * Resolves the configured StorageProvider. Adding a provider means adding a
 * class and one case here — no other file needs to change.
 */
export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const config = env();
  switch (config.STORAGE_PROVIDER) {
    case "google-drive":
      cached = new GoogleDriveStorageProvider({
        stockFolderId: config.GOOGLE_DRIVE_STOCK_FOLDER_ID!,
        serviceAccountEmail: config.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
        privateKey: config.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!,
      });
      break;
    case "local":
    default:
      cached = new LocalStorageProvider(config.LOCAL_STOCK_PATH);
      break;
  }
  return cached;
}

/** Test seam — resets the memoised provider. */
export function resetStorageProvider(): void {
  cached = null;
}
