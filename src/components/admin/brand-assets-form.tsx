"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  deleteBrandAssetAction,
  uploadBrandAssetAction,
} from "@/app/actions/admin-actions";

interface Slot {
  key: string;
  label: string;
  uploaded: boolean;
  updatedAt: string | null;
  sizeKb: number | null;
}

/**
 * Replaces the store's drawn marks with real artwork.
 *
 * Each slot falls back to the SVG version when empty, so the store is never
 * unbranded and removing an upload is a safe undo rather than a hole.
 */
export function BrandAssetsForm({ slots }: { slots: Slot[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const forms = useRef<Record<string, HTMLFormElement | null>>({});

  async function upload(event: React.FormEvent<HTMLFormElement>, key: string) {
    event.preventDefault();
    setError(null);
    setDone(null);
    setBusy(key);
    try {
      const result = await uploadBrandAssetAction(new FormData(event.currentTarget));
      if (!result.ok) setError(result.error);
      else {
        setDone("Uploaded. It is live on the storefront now.");
        forms.current[key]?.reset();
        router.refresh();
      }
    } catch {
      // Reaching here means the request itself never completed — the action
      // returns a reason for anything it can see. In practice that is the body
      // size limit or a dropped connection.
      setError(
        "The upload did not reach the server. If the file is large, try a smaller one; otherwise check your connection and retry.",
      );
    } finally {
      setBusy(null);
    }
  }

  function remove(key: string) {
    setError(null);
    setDone(null);
    setBusy(key);
    startTransition(async () => {
      const result = await deleteBrandAssetAction(key);
      if (!result.ok) setError(result.error);
      else setDone("Removed. The drawn version is showing again.");
      setBusy(null);
      router.refresh();
    });
  }

  return (
    <section className="comic-card grid gap-4 p-4">
      <div>
        <h2 className="section-title">Brand images</h2>
        <p className="mt-1 text-xs text-[var(--color-graphite)]">
          Upload your own artwork. Until you do, the store draws each mark
          itself, so nothing is ever missing. PNG, JPG, WebP or SVG, up to 2MB.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border-2 border-[var(--color-electric)] bg-[var(--color-white)] p-2.5 text-xs font-semibold text-[var(--color-electric)]">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-volt)] p-2.5 text-xs font-bold uppercase text-[var(--color-slab)]">
          {done}
        </p>
      )}

      {slots.map((slot) => (
        <div key={slot.key} className="grid gap-2 border-t border-[var(--color-line)] pt-4 first:border-t-0 first:pt-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-bold uppercase tracking-[0.06em]">{slot.label}</p>
            <p className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--color-steel)]">
              {slot.uploaded ? `${slot.sizeKb}KB uploaded` : "drawn"}
            </p>
          </div>

          {slot.uploaded && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- served
                  from our own route, and never a fixed intrinsic size. */}
              <img
                src={`/api/brand/${slot.key}?v=${encodeURIComponent(slot.updatedAt ?? "")}`}
                alt={`${slot.label}, as uploaded`}
                className="h-16 w-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-slab)] p-1"
              />
              <button
                type="button"
                onClick={() => remove(slot.key)}
                disabled={pending || busy === slot.key}
                className="btn btn-ghost px-3 text-xs"
              >
                {busy === slot.key ? "Removing…" : "Remove"}
              </button>
            </div>
          )}

          <form
            ref={(el) => {
              forms.current[slot.key] = el;
            }}
            onSubmit={(e) => upload(e, slot.key)}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="key" value={slot.key} />
            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              required
              className="field flex-1"
              aria-label={`Upload ${slot.label}`}
            />
            <button type="submit" disabled={busy === slot.key} className="btn btn-primary px-4 text-xs">
              {busy === slot.key ? "Uploading…" : slot.uploaded ? "Replace" : "Upload"}
            </button>
          </form>
        </div>
      ))}
    </section>
  );
}
