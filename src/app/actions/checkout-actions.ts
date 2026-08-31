"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { consumeVerifiedToken, sendOtp, verifyOtp } from "@/lib/auth/otp";
import { createCustomerSession, getCurrentCustomer } from "@/lib/auth/session";
import { clearCart, getCart } from "@/lib/cart";
import { db } from "@/lib/db";
import { placeOrder } from "@/lib/orders/service";
import { normalisePhone } from "@/lib/phone";

/**
 * Checkout server actions.
 *
 * The trust boundary is `consumeVerifiedToken`: an order is only created for a
 * phone number the caller has proven control of in this session. Everything the
 * client sends — prices, totals, customer id — is ignored and re-derived here.
 */

export type CheckoutStepResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; retryAfterSeconds?: number };

/** Coarse client identity for rate limiting. Best-effort behind a proxy. */
async function clientKey(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ??
    store.get("x-real-ip") ??
    "unknown"
  );
}

const phoneSchema = z.string().min(6).max(20);

export async function requestOtpAction(
  rawPhone: string,
): Promise<CheckoutStepResult<{ phone: string; isReturning: boolean }>> {
  const parsed = phoneSchema.safeParse(rawPhone);
  if (!parsed.success) {
    return { ok: false, error: "Enter your phone number." };
  }

  const phone = normalisePhone(parsed.data);
  if (!phone) {
    return { ok: false, error: "Enter a valid Maldivian mobile number." };
  }

  const existing = await db.customer.findUnique({ where: { phone: phone.e164 } });
  const result = await sendOtp(phone.e164, "checkout", await clientKey());

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  }

  return { ok: true, phone: phone.e164, isReturning: Boolean(existing) };
}

const verifySchema = z.object({
  phone: z.string(),
  code: z.string().regex(/^\d{4,8}$/, "Enter the code from the SMS."),
});

export interface SavedAddressSummary {
  id: string;
  recipientName: string;
  addressLine: string;
  area: string;
  island: string;
  instructions: string | null;
}

export async function verifyOtpAction(input: {
  phone: string;
  code: string;
}): Promise<
  CheckoutStepResult<{
    verifiedToken: string;
    customerName: string | null;
    savedAddress: SavedAddressSummary | null;
  }>
> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter the code from the SMS." };
  }

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return { ok: false, error: "Enter a valid phone number." };

  const result = await verifyOtp(phone.e164, "checkout", parsed.data.code);
  if (!result.ok) return { ok: false, error: result.error };

  // A returning customer's saved address is loaded here so they never re-type
  // it — but only after they have proven the number is theirs.
  const customer = await db.customer.findUnique({
    where: { phone: phone.e164 },
    include: {
      addresses: { orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], take: 1 },
    },
  });

  const address = customer?.addresses[0];

  return {
    ok: true,
    verifiedToken: result.verifiedToken,
    customerName: customer?.name ?? null,
    savedAddress: address
      ? {
          id: address.id,
          recipientName: address.recipientName,
          addressLine: address.addressLine,
          area: address.area,
          island: address.island,
          instructions: address.instructions,
        }
      : null,
  };
}

const placeOrderSchema = z.object({
  phone: z.string(),
  verifiedToken: z.string().min(10),
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  addressLine: z.string().trim().min(5, "Enter your delivery address.").max(300),
  area: z.string().trim().min(1, "Choose a delivery area.").max(80),
  island: z.string().trim().max(80).optional(),
  instructions: z.string().trim().max(300).optional(),
  paymentMethod: z.string().min(1),
  saveAddress: z.boolean().optional(),
});

export async function placeOrderAction(
  input: z.input<typeof placeOrderSchema>,
): Promise<CheckoutStepResult<{ orderNumber: string }>> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check your details.",
    };
  }
  const data = parsed.data;

  const phone = normalisePhone(data.phone);
  if (!phone) return { ok: false, error: "Enter a valid phone number." };

  // Single-use: this both authenticates the phone and prevents a replayed
  // token from placing a second order.
  const verified = await consumeVerifiedToken(data.verifiedToken, phone.e164);
  if (!verified) {
    return {
      ok: false,
      error: "Your verification expired. Please verify your number again.",
    };
  }

  const cart = await getCart();
  if (cart.lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  // Account is created (or reused) from the verified number — no separate
  // registration form, which is the whole point of the flow.
  const customer = await db.customer.upsert({
    where: { phone: phone.e164 },
    create: { phone: phone.e164, name: data.name },
    update: { name: data.name },
  });

  const result = await placeOrder({
    customerId: customer.id,
    lines: cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    shipping: {
      recipientName: data.name,
      phone: phone.e164,
      addressLine: data.addressLine,
      area: data.area,
      island: data.island,
      instructions: data.instructions,
    },
    paymentMethod: data.paymentMethod,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (data.saveAddress !== false) {
    await saveDefaultAddress(customer.id, {
      recipientName: data.name,
      phone: phone.e164,
      addressLine: data.addressLine,
      area: data.area,
      island: data.island ?? "",
      instructions: data.instructions ?? null,
    });
  }

  if (cart.id) await clearCart(cart.id);
  await createCustomerSession(customer.id);

  return { ok: true, orderNumber: result.orderNumber };
}

async function saveDefaultAddress(
  customerId: string,
  address: {
    recipientName: string;
    phone: string;
    addressLine: string;
    area: string;
    island: string;
    instructions: string | null;
  },
): Promise<void> {
  const existing = await db.address.findFirst({
    where: { customerId, isDefault: true },
  });

  if (existing) {
    await db.address.update({ where: { id: existing.id }, data: address });
    return;
  }

  await db.address.create({
    data: { ...address, customerId, isDefault: true, label: "Home" },
  });
}

/** Passwordless login for the account area, outside checkout. */
export async function loginRequestOtpAction(
  rawPhone: string,
): Promise<CheckoutStepResult<{ phone: string }>> {
  const phone = normalisePhone(rawPhone ?? "");
  if (!phone) return { ok: false, error: "Enter a valid Maldivian mobile number." };

  const result = await sendOtp(phone.e164, "login", await clientKey());
  if (!result.ok) {
    return { ok: false, error: result.error, retryAfterSeconds: result.retryAfterSeconds };
  }
  return { ok: true, phone: phone.e164 };
}

export async function loginVerifyOtpAction(input: {
  phone: string;
  code: string;
}): Promise<CheckoutStepResult> {
  const phone = normalisePhone(input.phone ?? "");
  if (!phone) return { ok: false, error: "Enter a valid phone number." };

  const result = await verifyOtp(phone.e164, "login", input.code ?? "");
  if (!result.ok) return { ok: false, error: result.error };

  const customer = await db.customer.findUnique({ where: { phone: phone.e164 } });
  if (!customer || !customer.active) {
    // Deliberately the same wording either way, so this endpoint cannot be used
    // to discover which numbers have accounts.
    return { ok: false, error: "No orders found for this number yet." };
  }

  await consumeVerifiedToken(result.verifiedToken, phone.e164);
  await createCustomerSession(customer.id);
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  const { destroyCustomerSession } = await import("@/lib/auth/session");
  await destroyCustomerSession();
}

export async function getCurrentCustomerAction() {
  return getCurrentCustomer();
}
