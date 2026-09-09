import { NextResponse } from "next/server";

import { isBrandSlot, readBrandAsset } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * Serves an uploaded brand image.
 *
 * The slot name is validated against a fixed list rather than passed through,
 * so this route can only ever return the two rows it is meant to.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!isBrandSlot(key)) return new NextResponse("Not found", { status: 404 });

  const asset = await readBrandAsset(key);
  if (!asset) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.bytes.byteLength),
      // The checksum is the validator, so replacing the logo changes the ETag
      // and browsers pick the new one up rather than serving the old for a day.
      ETag: `"${asset.checksum}"`,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
}
