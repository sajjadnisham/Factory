/**
 * Writes placeholder product images into the STOCK folders.
 *
 * Real product photography comes from the store owner. These stand-ins exist so
 * a fresh clone can run the seed and see a populated storefront — they are
 * generated rather than committed, which keeps the repository small and makes
 * it obvious they are not real products.
 *
 * Usage: npm run stock:images [-- --force]
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const STOCK_ROOT = path.resolve(process.cwd(), process.env.LOCAL_STOCK_PATH ?? "./stock");
const MANIFEST = path.join(STOCK_ROOT, ".image-manifest.json");

const WIDTH = 900;
const HEIGHT = 1200;

type Rgb = [number, number, number];

/** Colour names a store owner is likely to use, so the placeholder matches. */
const COLOUR_MAP: Record<string, Rgb> = {
  black: [26, 26, 28],
  "washed black": [58, 56, 58],
  charcoal: [54, 56, 60],
  "dark grey": [72, 74, 78],
  grey: [126, 128, 132],
  "grey marl": [150, 152, 156],
  white: [238, 238, 236],
  bone: [226, 220, 208],
  ecru: [222, 212, 192],
  sand: [206, 186, 158],
  natural: [214, 202, 178],
  olive: [92, 96, 68],
  navy: [38, 48, 74],
  indigo: [56, 72, 112],
  "red check": [140, 54, 48],
};

function colourFor(name: string | undefined, seed: string): Rgb {
  const known = name ? COLOUR_MAP[name.trim().toLowerCase()] : undefined;
  if (known) return known;

  // Unknown colour: derive a stable, muted tone from the folder name so the
  // same product always renders the same way.
  const hash = createHash("sha256").update(seed).digest();
  return [90 + (hash[0]! % 90), 90 + (hash[1]! % 90), 90 + (hash[2]! % 90)];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Minimal PNG encoder — a vertical gradient with a diagonal band, so each image
 * in a folder looks distinct enough to tell that swiping is working.
 */
function renderPng(base: Rgb, variant: number): Buffer {
  const shift = (variant - 1) * 14;
  const rows: Buffer[] = [];

  for (let y = 0; y < HEIGHT; y += 1) {
    // Filter byte 0 (None) then RGB triples for the row.
    const row = Buffer.alloc(1 + WIDTH * 3);
    const gradient = (y / HEIGHT) * 34 - 17;

    for (let x = 0; x < WIDTH; x += 1) {
      // A soft diagonal band gives the flat colour some structure.
      const band = ((x + y * 0.6 + variant * 160) % 520) < 190 ? 10 : 0;
      const offset = 1 + x * 3;
      row[offset] = clamp(base[0] + gradient + shift + band);
      row[offset + 1] = clamp(base[1] + gradient + shift + band);
      row[offset + 2] = clamp(base[2] + gradient + shift + band);
    }
    rows.push(row);
  }

  const chunk = (type: string, data: Buffer): Buffer => {
    const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(typeAndData) >>> 0);
    return Buffer.concat([length, typeAndData, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function firstColourOf(folder: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(path.join(STOCK_ROOT, folder, "product.json"), "utf8");
    const parsed = JSON.parse(raw) as { colors?: string[] };
    return parsed.colors?.[0];
  } catch {
    return undefined;
  }
}

/**
 * Writes any placeholder images the manifest calls for that are not on disk.
 *
 * Exported so callers can run it in-process. The seed script used to spawn this
 * file as a child, which cost a whole extra Node process — affordable on a
 * laptop, not inside a 512MB container that is also running the web server.
 */
export async function generatePlaceholderImages(
  { force = false }: { force?: boolean } = {},
): Promise<{ written: number; skipped: number }> {
  let manifest: Record<string, number>;
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST, "utf8")) as Record<string, number>;
  } catch {
    throw new Error(`No image manifest at ${MANIFEST}. Is LOCAL_STOCK_PATH correct?`);
  }

  let written = 0;
  let skipped = 0;

  for (const [folder, count] of Object.entries(manifest)) {
    const dir = path.join(STOCK_ROOT, folder);
    try {
      await fs.access(dir);
    } catch {
      console.warn(`  ! ${folder} — folder missing, skipped`);
      continue;
    }

    const base = colourFor(await firstColourOf(folder), folder);

    for (let i = 1; i <= count; i += 1) {
      const file = path.join(dir, `${String(i).padStart(2, "0")}.png`);
      if (!force) {
        try {
          await fs.access(file);
          skipped += 1;
          continue;
        } catch {
          // Not there yet — fall through and write it.
        }
      }
      await fs.writeFile(file, renderPng(base, i));
      written += 1;
    }
  }

  console.log(`Placeholder images: ${written} written, ${skipped} already present.`);
  if (skipped > 0 && !force) {
    console.log("Pass --force to regenerate the existing ones.");
  }

  return { written, skipped };
}

// CLI entry point: npm run stock:images [-- --force]
if (process.argv[1] && path.resolve(process.argv[1]).endsWith("generate-images.ts")) {
  generatePlaceholderImages({ force: process.argv.includes("--force") }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
