import { db } from "@/lib/db";

/**
 * Business configuration, editable by the admin rather than compiled into the
 * UI. Every key has a typed default here, so a fresh install works before the
 * owner has configured anything — and no business-critical number is hardcoded
 * in a component.
 *
 * Placeholders below are deliberate: the store owner supplies the real brand
 * name, contact details and policies. Nothing here invents business facts.
 */

export interface StoreSettings {
  storeName: string;
  tagline: string;
  logoText: string;

  // Delivery — all money in laari (MVR * 100).
  deliveryFeeMinor: number;
  freeDeliveryThresholdMinor: number;
  deliveryAreas: string[];
  deliveryEstimate: string;
  /** Delivery headline on the homepage brand block. */
  deliveryHeadline: string;

  // Payment methods offered at checkout.
  paymentMethods: { id: string; label: string; description: string; enabled: boolean }[];

  // Contact — placeholders until the owner supplies real details.
  contactPhone: string;
  contactEmail: string;
  whatsapp: string;
  businessAddress: string;
  instagram: string;
  facebook: string;

  // Homepage
  heroHeadline: string;
  heroSubline: string;
  heroCtaLabel: string;
  promoMessage: string;
  brandMessage: string;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Factory",
  tagline: "Men's streetwear, Maldives",
  logoText: "FACTORY",

  deliveryFeeMinor: 5000, // MVR 50
  freeDeliveryThresholdMinor: 100_000, // MVR 1,000
  deliveryAreas: ["Malé", "Hulhumalé", "Vilimalé", "Airport / Hulhulé"],
  deliveryEstimate: "1–2 days within Greater Malé",
  deliveryHeadline: "Free delivery within Greater Malé area",

  paymentMethods: [
    {
      id: "bank_transfer",
      label: "Bank transfer",
      description: "Transfer to the store account and send the receipt on WhatsApp.",
      enabled: true,
    },
    {
      id: "cash_on_delivery",
      label: "Cash on delivery",
      description: "Pay the rider in cash when your order arrives.",
      enabled: true,
    },
  ],

  contactPhone: "",
  contactEmail: "",
  whatsapp: "",
  businessAddress: "",
  instagram: "",
  facebook: "",

  heroHeadline: "BUILT FOR THE STREET",
  heroSubline: "Oversized fits, heavyweight cotton, no filler.",
  heroCtaLabel: "SHOP NOW",
  promoMessage: "Free delivery in Malé over MVR 1,000",
  brandMessage:
    "Everyday style, made simple. Quality pieces, fair prices, and fresh drops without the hype.",
};

export async function getSettings(): Promise<StoreSettings> {
  let rows: { key: string; value: unknown }[];

  try {
    rows = await db.storeSetting.findMany();
  } catch (error) {
    // The defaults above are a complete, working configuration, so presentation
    // never depends on the database being reachable. This matters at build
    // time: `next build` prerenders pages whose metadata reads settings, and a
    // container image is built without a database to connect to.
    console.warn(
      "[settings] falling back to defaults — store settings could not be read:",
      error instanceof Error ? error.message : error,
    );
    return { ...DEFAULT_SETTINGS };
  }

  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  // Merge per key so a partially configured store still gets defaults for the
  // rest, and an unknown stored key never breaks rendering.
  const merged = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof StoreSettings)[]) {
    const value = stored[key];
    if (value === undefined || value === null) continue;
    if (typeof value === typeof DEFAULT_SETTINGS[key]) {
      (merged[key] as unknown) = value;
    } else if (Array.isArray(DEFAULT_SETTINGS[key]) && Array.isArray(value)) {
      (merged[key] as unknown) = value;
    }
  }
  return merged;
}

export async function updateSettings(
  patch: Partial<StoreSettings>,
  actor: string,
): Promise<void> {
  const entries = Object.entries(patch).filter(([key]) => key in DEFAULT_SETTINGS);

  await db.$transaction(
    entries.map(([key, value]) =>
      db.storeSetting.upsert({
        where: { key },
        create: { key, value: value as never },
        update: { value: value as never },
      }),
    ),
  );

  console.info(`[settings] ${entries.length} key(s) updated by ${actor}`);
}

/** Delivery fee for a subtotal, honouring the free-delivery threshold. */
export function calculateDeliveryFee(
  subtotalMinor: number,
  settings: StoreSettings,
): number {
  if (subtotalMinor <= 0) return 0;
  if (
    settings.freeDeliveryThresholdMinor > 0 &&
    subtotalMinor >= settings.freeDeliveryThresholdMinor
  ) {
    return 0;
  }
  return settings.deliveryFeeMinor;
}
