import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getStorageProvider } from "@/lib/storage";

/**
 * Streams a product image from the storage provider.
 *
 * The route takes a ProductImage row id, not a raw storage id, so a visitor can
 * only ever fetch files this catalogue actually references — a Drive file id
 * guessed from elsewhere in the owner's Drive is not reachable here. Storage
 * credentials stay on the server; the browser only ever sees this URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const image = await db.productImage.findUnique({
    where: { id },
    include: { product: { select: { active: true } } },
  });

  if (!image || !image.product.active) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const buffer = await getStorageProvider().readFile(image.sourceFileId);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeFor(image.fileName),
        // Long cache with the content hash as the validator: replacing the
        // image in STOCK changes the ETag, so browsers pick it up on next sync.
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        ETag: `"${image.contentHash ?? image.id}"`,
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (error) {
    // A storage failure must not surface provider internals to the customer.
    console.error(`[images] failed to read ${image.sourceFileId}:`, error);
    return new NextResponse("Image unavailable", { status: 502 });
  }
}

function contentTypeFor(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    default:
      return "image/jpeg";
  }
}
