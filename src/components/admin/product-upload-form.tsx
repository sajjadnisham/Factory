"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { uploadProductAction } from "@/app/actions/admin-actions";

const TYPES = [
  { value: "tshirt", label: "T-Shirt" },
  { value: "shirt", label: "Shirt" },
  { value: "pants", label: "Pants" },
  { value: "shorts", label: "Shorts" },
  { value: "hoodie", label: "Hoodie" },
  { value: "jacket", label: "Jacket" },
  { value: "accessory", label: "Accessory" },
];

const SIZE_PRESETS: Record<string, string> = {
  tshirt: "S, M, L, XL, XXL",
  shirt: "S, M, L, XL",
  hoodie: "S, M, L, XL, XXL",
  jacket: "S, M, L, XL",
  pants: "30, 32, 34, 36",
  shorts: "S, M, L, XL",
  accessory: "ONE SIZE",
};

const MAX_IMAGES = 5;
const MAX_IMAGE_MB = 4;

interface Preview {
  url: string;
  name: string;
  sizeMb: string;
  tooBig: boolean;
}

/**
 * Adds a product without a Drive account or a redeploy.
 *
 * The form writes a product.json and the photos into the uploaded-STOCK tables,
 * then runs a sync — so what comes back is the sync report, not a "saved"
 * message. That is deliberate: the parser is what decides whether a product is
 * valid, and the store owner should see its verdict on the thing they just
 * submitted rather than discovering it later on the shop page.
 */
export function ProductUploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState("tshirt");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function onPickImages(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_IMAGES);
    // Revoke the previous batch before replacing it, or every re-pick leaks a
    // blob URL for the lifetime of the page.
    for (const p of previews) URL.revokeObjectURL(p.url);
    setPreviews(
      files.map((file) => ({
        url: URL.createObjectURL(file),
        name: file.name,
        sizeMb: (file.size / 1024 / 1024).toFixed(1),
        tooBig: file.size > MAX_IMAGE_MB * 1024 * 1024,
      })),
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(null);
    setPending(true);

    try {
      const result = await uploadProductAction(new FormData(event.currentTarget));

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const { report, folderName } = result;
      if (report.invalidProducts > 0) {
        setError(
          `Saved, but the sync rejected something. Check the product inspector: ${report.issues
            .slice(0, 2)
            .map((i) => i.message)
            .join(" ")}`,
        );
        return;
      }

      setDone(`${folderName} is live.`);
      for (const p of previews) URL.revokeObjectURL(p.url);
      setPreviews([]);
      formRef.current?.reset();
      setType("tshirt");
      router.refresh();
    } catch (cause) {
      // A rejected upload is usually the body-size limit, which surfaces as a
      // network failure rather than an action result.
      setError(
        cause instanceof Error
          ? `Upload failed: ${cause.message}. If the photos are large, try fewer or smaller ones.`
          : "Upload failed. Try fewer or smaller photos.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="comic-card grid gap-4 p-4">
      <div>
        <h2 className="section-title">Add a product</h2>
        <p className="mt-1 text-xs text-[var(--color-graphite)]">
          Photos and details go straight into the catalogue. The first photo is
          the one customers see on the card.
        </p>
      </div>

      {/* --- Photos ------------------------------------------------------- */}
      <div>
        <label className="field-label" htmlFor="images">
          Photos — up to {MAX_IMAGES}, {MAX_IMAGE_MB}MB each
        </label>
        <input
          id="images"
          name="images"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          onChange={onPickImages}
          className="field"
        />

        {previews.length > 0 && (
          <ul className="mt-2.5 grid grid-cols-5 gap-1.5">
            {previews.map((preview, i) => (
              <li key={preview.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a
                    blob: URL from the file picker, never a remote asset. */}
                <img
                  src={preview.url}
                  alt={preview.name}
                  className={`aspect-[3/4] w-full rounded-lg border-2 object-cover ${
                    preview.tooBig
                      ? "border-[var(--color-electric)]"
                      : "border-[var(--color-ink)]"
                  }`}
                />
                <span className="sticker sticker-new absolute left-1 top-1">
                  {i === 0 ? "Card" : i + 1}
                </span>
                {preview.tooBig && (
                  <span className="mt-0.5 block text-[9px] font-bold text-[var(--color-electric)]">
                    {preview.sizeMb}MB — too big
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- Identity ----------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="sku">Code (SKU)</label>
          <input id="sku" name="sku" required placeholder="TSHIRT-006" className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="type">Category</label>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="field"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="name">Product name</label>
        <input id="name" name="name" required placeholder="Oversized Basic Tee" className="field" />
      </div>

      {/* --- Money -------------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="price">Price (MVR)</label>
          <input id="price" name="price" type="number" min="0" step="1" required placeholder="750" className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="comparePrice">
            Was (MVR) — optional, shows a Sale badge
          </label>
          <input id="comparePrice" name="comparePrice" type="number" min="0" step="1" placeholder="950" className="field" />
        </div>
      </div>

      {/* --- Variants ----------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="sizes">Sizes — comma separated</label>
          <input
            id="sizes"
            name="sizes"
            key={type}
            defaultValue={SIZE_PRESETS[type] ?? "S, M, L, XL"}
            className="field"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="colors">Colours — comma separated</label>
          <input id="colors" name="colors" placeholder="Black, White" className="field" />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="stock">
          Stock — total, split across every size and colour
        </label>
        <input id="stock" name="stock" type="number" min="0" step="1" defaultValue={20} className="field" />
      </div>

      <div>
        <label className="field-label" htmlFor="description">Description — optional</label>
        <textarea id="description" name="description" rows={3} className="field" placeholder="Heavyweight cotton, boxy fit." />
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="featured" className="h-5 w-5 accent-[var(--color-electric)]" />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="newArrival" defaultChecked className="h-5 w-5 accent-[var(--color-electric)]" />
          New arrival
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border-2 border-[var(--color-electric)] bg-white p-2.5 text-xs font-semibold text-[var(--color-electric)]">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-volt)] p-2.5 text-xs font-bold uppercase">
          {done}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Uploading…" : "Publish product"}
      </button>
    </form>
  );
}
