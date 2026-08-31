"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyPassword } from "@/lib/auth/password";
import {
  createAdminSession,
  destroyAdminSession,
  getCurrentAdmin,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import { markOrderPaid, releaseOrderStock, updateOrderStatus } from "@/lib/orders/service";
import { syncStock, type SyncReport } from "@/lib/products/sync";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { updateSettings, type StoreSettings } from "@/lib/settings";

/**
 * Admin actions.
 *
 * Every mutation starts with `requireAdminOrFail`. Authorisation is checked
 * here rather than only in the page, because a server action is a callable
 * endpoint — rendering the page behind a guard would not protect the action.
 */

export type AdminResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function requireAdminOrFail(): Promise<
  { ok: true; username: string } | { ok: false; error: string }
> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "Your session expired. Please sign in again." };
  return { ok: true, username: admin.username };
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export async function adminLoginAction(
  input: z.input<typeof loginSchema>,
): Promise<AdminResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter your username and password." };
  }

  const store = await headers();
  const clientKey =
    store.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Throttled by client and by username, so neither a single attacker nor a
  // distributed one gets unlimited guesses at one account.
  const limit = await checkRateLimit(`admin:login:${clientKey}`, 10, 900);
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }
  const userLimit = await checkRateLimit(
    `admin:login:user:${parsed.data.username.toLowerCase()}`,
    10,
    900,
  );
  if (!userLimit.allowed) {
    return { ok: false, error: "Too many attempts. Please try again later." };
  }

  const admin = await db.adminUser.findUnique({
    where: { username: parsed.data.username },
  });

  // Same message for unknown user and wrong password — never confirm which
  // usernames exist.
  const invalid = { ok: false as const, error: "Invalid username or password." };
  if (!admin || !admin.active) return invalid;

  const valid = await verifyPassword(parsed.data.password, admin.passwordHash);
  if (!valid) return invalid;

  await resetRateLimit(`admin:login:user:${parsed.data.username.toLowerCase()}`);
  await createAdminSession(admin.id);
  return { ok: true };
}

export async function adminLogoutAction(): Promise<void> {
  await destroyAdminSession();
}

// ---------------------------------------------------------------------------
// Stock sync
// ---------------------------------------------------------------------------

export async function syncStockAction(): Promise<AdminResult<{ report: SyncReport }>> {
  const auth = await requireAdminOrFail();
  if (!auth.ok) return auth;

  // A sync hits the storage provider's API quota, so it is throttled.
  const limit = await checkRateLimit("admin:sync", 12, 300);
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Sync is throttled. Try again in ${limit.retryAfterSeconds}s.`,
    };
  }

  try {
    const report = await syncStock({ triggeredBy: auth.username });
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    revalidatePath("/", "layout");
    return { ok: true, report };
  } catch (error) {
    // Provider failures reach the admin verbatim — they are the person who can
    // fix a bad credential or a missing folder.
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Sync failed.",
    };
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const ALLOWED_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "out_for_delivery",
  "delivered",
] as const;

export async function updateOrderStatusAction(
  orderId: string,
  status: string,
): Promise<AdminResult> {
  const auth = await requireAdminOrFail();
  if (!auth.ok) return auth;

  if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
    return { ok: false, error: "Unknown order status." };
  }

  await updateOrderStatus(orderId, status, auth.username);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function markOrderPaidAction(
  orderId: string,
  reference: string,
): Promise<AdminResult> {
  const auth = await requireAdminOrFail();
  if (!auth.ok) return auth;

  // This is the human verification step for offline payments: staff confirm the
  // transfer landed, which is what actually marks the order paid.
  await markOrderPaid(orderId, reference.trim() || null, auth.username);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function cancelOrderAction(
  orderId: string,
  reason: string,
): Promise<AdminResult> {
  const auth = await requireAdminOrFail();
  if (!auth.ok) return auth;

  await releaseOrderStock(
    orderId,
    reason.trim() || "Cancelled by store",
    auth.username,
  );
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  storeName: z.string().trim().min(1).max(60).optional(),
  tagline: z.string().trim().max(120).optional(),
  logoText: z.string().trim().min(1).max(24).optional(),
  deliveryFeeMinor: z.coerce.number().int().min(0).max(1_000_000).optional(),
  freeDeliveryThresholdMinor: z.coerce.number().int().min(0).max(100_000_000).optional(),
  deliveryAreas: z.array(z.string().trim().min(1)).max(50).optional(),
  deliveryEstimate: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  contactEmail: z.string().trim().max(120).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  businessAddress: z.string().trim().max(200).optional(),
  instagram: z.string().trim().max(120).optional(),
  facebook: z.string().trim().max(120).optional(),
  heroHeadline: z.string().trim().max(80).optional(),
  heroSubline: z.string().trim().max(160).optional(),
  heroCtaLabel: z.string().trim().max(30).optional(),
  promoMessage: z.string().trim().max(120).optional(),
  brandMessage: z.string().trim().max(400).optional(),
});

export async function updateSettingsAction(
  input: Record<string, unknown>,
): Promise<AdminResult> {
  const auth = await requireAdminOrFail();
  if (!auth.ok) return auth;

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the values.",
    };
  }

  await updateSettings(parsed.data as Partial<StoreSettings>, auth.username);
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleProductActiveAction(
  productId: string,
  active: boolean,
): Promise<AdminResult> {
  const auth = await requireAdminOrFail();
  if (!auth.ok) return auth;

  // Deactivating hides a product without touching STOCK. The next sync will
  // reinstate it if the folder still says active — the folder stays the source
  // of truth, so this is a temporary override rather than a second one.
  await db.product.update({ where: { id: productId }, data: { active } });
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
  return { ok: true };
}
