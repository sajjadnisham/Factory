"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentCustomer } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * Account mutations. Every one re-reads the session and scopes its query by the
 * signed-in customer id, so no customer can reach another customer's data even
 * by supplying a valid-looking address id.
 */

export type Result = { ok: true } | { ok: false; error: string };

const addressSchema = z.object({
  recipientName: z.string().trim().min(2).max(80),
  addressLine: z.string().trim().min(5).max(300),
  area: z.string().trim().min(1).max(80),
  island: z.string().trim().max(80).optional(),
  instructions: z.string().trim().max(300).optional(),
});

export async function saveAddressAction(
  input: z.input<typeof addressSchema>,
): Promise<Result> {
  const customer = await getCurrentCustomer();
  if (!customer) return { ok: false, error: "Please sign in first." };

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the address.",
    };
  }

  const data = {
    ...parsed.data,
    island: parsed.data.island ?? "",
    instructions: parsed.data.instructions ?? null,
    phone: customer.phone,
  };

  const existing = await db.address.findFirst({
    where: { customerId: customer.id, isDefault: true },
  });

  if (existing) {
    await db.address.update({ where: { id: existing.id }, data });
  } else {
    await db.address.create({
      data: { ...data, customerId: customer.id, isDefault: true, label: "Home" },
    });
  }

  revalidatePath("/account/address");
  revalidatePath("/account");
  return { ok: true };
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
});

export async function updateProfileAction(
  input: z.input<typeof profileSchema>,
): Promise<Result> {
  const customer = await getCurrentCustomer();
  if (!customer) return { ok: false, error: "Please sign in first." };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter your name." };
  }

  await db.customer.update({
    where: { id: customer.id },
    data: { name: parsed.data.name },
  });

  revalidatePath("/account");
  return { ok: true };
}
