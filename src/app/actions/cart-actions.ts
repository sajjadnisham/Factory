"use server";

import { revalidatePath } from "next/cache";

import { addToCart, removeFromCart, updateCartLine } from "@/lib/cart";

/**
 * Cart mutations. Server actions rather than API routes: Next.js gives them
 * CSRF protection via the action id, and the variant price is never accepted
 * from the client — it is read from the database inside the cart service.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function addToCartAction(
  variantId: string,
  quantity = 1,
): Promise<ActionResult> {
  if (typeof variantId !== "string" || variantId.length === 0) {
    return { ok: false, error: "Choose a size first." };
  }

  const result = await addToCart(variantId, quantity);
  if (!result.ok) return result;

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCartLineAction(
  variantId: string,
  quantity: number,
): Promise<ActionResult> {
  const result = await updateCartLine(variantId, Math.trunc(quantity));
  if (!result.ok) return result;

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeFromCartAction(variantId: string): Promise<ActionResult> {
  await removeFromCart(variantId);
  revalidatePath("/cart");
  revalidatePath("/", "layout");
  return { ok: true };
}
