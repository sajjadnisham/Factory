"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { formatMvr } from "@/lib/money";

interface Props {
  options: {
    colors: string[];
    sizes: string[];
    minPriceMinor: number;
    maxPriceMinor: number;
  };
  basePath: string;
}

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "featured", label: "Featured" },
] as const;

/**
 * Filter and sort controls. State lives in the URL so a filtered view is
 * shareable and the back button behaves, and the panel stays collapsed on
 * mobile so filters never push the grid off screen.
 */
export function ProductFilters({ options, basePath }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeColors = params.getAll("color");
  const activeSizes = params.getAll("size");
  const activeSort = params.get("sort") ?? "newest";
  const inStockOnly = params.get("in_stock") === "1";
  const maxPrice = params.get("max_price");

  const activeCount =
    activeColors.length + activeSizes.length + (inStockOnly ? 1 : 0) + (maxPrice ? 1 : 0);

  function apply(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete("page"); // a changed filter always returns to page one
    const query = next.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  function toggleMulti(key: string, value: string) {
    apply((next) => {
      const current = next.getAll(key);
      next.delete(key);
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      for (const v of updated) next.append(key, v);
    });
  }

  return (
    <div className="mb-3">
      <div className="chip-row">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`btn shrink-0 px-3 text-xs ${activeCount > 0 ? "btn-primary" : "btn-ghost"}`}
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>

        {SORTS.map((sort) => (
          <button
            key={sort.value}
            type="button"
            onClick={() => apply((next) => next.set("sort", sort.value))}
            aria-pressed={activeSort === sort.value}
            className={`btn btn-chip shrink-0 px-3 text-xs ${
              activeSort === sort.value ? "btn-dark" : "btn-ghost"
            }`}
          >
            {sort.label}
          </button>
        ))}
      </div>

      {open && (
        <div className="comic-card mt-2 grid gap-4 p-3.5">
          {options.sizes.length > 0 && (
            <fieldset>
              <legend className="field-label">Size</legend>
              <div className="flex flex-wrap gap-1.5">
                {options.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleMulti("size", size)}
                    aria-pressed={activeSizes.includes(size)}
                    className={`btn px-3 text-xs ${
                      activeSizes.includes(size) ? "btn-primary" : "btn-ghost"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {options.colors.length > 0 && (
            <fieldset>
              <legend className="field-label">Colour</legend>
              <div className="flex flex-wrap gap-1.5">
                {options.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => toggleMulti("color", color)}
                    aria-pressed={activeColors.includes(color)}
                    className={`btn px-3 text-xs ${
                      activeColors.includes(color) ? "btn-primary" : "btn-ghost"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {options.maxPriceMinor > options.minPriceMinor && (
            <fieldset>
              <legend className="field-label">
                Max price — {formatMvr(Number(maxPrice ?? options.maxPriceMinor))}
              </legend>
              <input
                type="range"
                min={options.minPriceMinor}
                max={options.maxPriceMinor}
                step={5000}
                defaultValue={Number(maxPrice ?? options.maxPriceMinor)}
                onChange={(e) => apply((next) => next.set("max_price", e.target.value))}
                className="w-full accent-[var(--color-electric)]"
                aria-label="Maximum price"
              />
            </fieldset>
          )}

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) =>
                apply((next) =>
                  e.target.checked ? next.set("in_stock", "1") : next.delete("in_stock"),
                )
              }
              className="h-5 w-5 accent-[var(--color-electric)]"
            />
            In stock only
          </label>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => router.push(basePath)}
              className="btn btn-ghost text-xs"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
