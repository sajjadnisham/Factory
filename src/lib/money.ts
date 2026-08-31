/**
 * Money is stored and computed as integer minor units (laari; 1 MVR = 100
 * laari) so that rounding never accumulates through subtotals and fees.
 * Only format at the very edge, when rendering.
 */

export const CURRENCY = "MVR" as const;

export function toMinor(major: number): number {
  return Math.round(major * 100);
}

export function toMajor(minor: number): number {
  return minor / 100;
}

/** "MVR 1,500" — whole rufiyaa are shown without decimals, as local shops do. */
export function formatMvr(minor: number): string {
  const major = minor / 100;
  const hasFraction = minor % 100 !== 0;
  const formatted = major.toLocaleString("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `MVR ${formatted}`;
}

/** Parses a price from STOCK metadata, which may be a number or a string. */
export function parsePriceToMinor(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input) && input >= 0) {
    return toMinor(input);
  }
  if (typeof input === "string") {
    const cleaned = input.replace(/[^0-9.]/g, "");
    if (cleaned === "" || cleaned.split(".").length > 2) return null;
    const parsed = Number.parseFloat(cleaned);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return toMinor(parsed);
  }
  return null;
}
