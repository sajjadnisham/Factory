import { db } from "@/lib/db";
import { getCurrentCustomer, getOrCreateCartToken, readCartToken } from "@/lib/auth/session";
import { calculateDeliveryFee, getSettings } from "@/lib/settings";

/**
 * Server-side cart. Deliberately not localStorage: the brief requires that
 * transactional data survive a lost phone, a cleared browser and a switch from
 * mobile to desktop, and prices must be re-read from the database at checkout
 * rather than trusted from the client.
 */

export interface CartLine {
  id: string;
  variantId: string;
  productSlug: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  imageUrl: string | null;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  availableStock: number;
  /** True when the cart holds more than the shelf currently has. */
  exceedsStock: boolean;
}

export interface CartSummary {
  id: string | null;
  lines: CartLine[];
  itemCount: number;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  hasIssues: boolean;
}

const EMPTY_CART: CartSummary = {
  id: null,
  lines: [],
  itemCount: 0,
  subtotalMinor: 0,
  deliveryFeeMinor: 0,
  totalMinor: 0,
  hasIssues: false,
};

/** Reads the cart without creating one — safe for render paths. */
export async function getCart(): Promise<CartSummary> {
  const token = await readCartToken();
  const customer = await getCurrentCustomer();
  if (!token && !customer) return EMPTY_CART;

  const cart = await db.cart.findFirst({
    where: customer
      ? { OR: [{ customerId: customer.id }, ...(token ? [{ token }] : [])] }
      : { token: token! },
    orderBy: { updatedAt: "desc" },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
            },
          },
        },
      },
    },
  });

  if (!cart) return EMPTY_CART;
  return summarise(cart.id, cart.items);
}

/** Reads or creates the cart — for mutations. */
export async function getOrCreateCart(): Promise<string> {
  const token = await getOrCreateCartToken();
  const customer = await getCurrentCustomer();

  const existing = await db.cart.findUnique({ where: { token } });
  if (existing) {
    // Claim the anonymous cart once the customer verifies their phone.
    if (customer && existing.customerId !== customer.id) {
      await db.cart.update({
        where: { id: existing.id },
        data: { customerId: customer.id },
      });
    }
    return existing.id;
  }

  const created = await db.cart.create({
    data: { token, customerId: customer?.id ?? null },
  });
  return created.id;
}

export async function addToCart(
  variantId: string,
  quantity = 1,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (quantity < 1 || quantity > 20) {
    return { ok: false, error: "Choose between 1 and 20 items." };
  }

  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });

  if (!variant || !variant.product.active) {
    return { ok: false, error: "That product is no longer available." };
  }
  if (variant.stock < 1) {
    return { ok: false, error: "That size is out of stock." };
  }

  const cartId = await getOrCreateCart();
  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId } },
  });

  const desired = (existing?.quantity ?? 0) + quantity;
  if (desired > variant.stock) {
    return {
      ok: false,
      error: `Only ${variant.stock} left in ${variant.size}.`,
    };
  }

  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity },
    update: { quantity: desired },
  });
  await db.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });

  return { ok: true };
}

export async function updateCartLine(
  variantId: string,
  quantity: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await readCartToken();
  if (!token) return { ok: false, error: "Your cart is empty." };

  const cart = await db.cart.findUnique({ where: { token } });
  if (!cart) return { ok: false, error: "Your cart is empty." };

  if (quantity <= 0) {
    await db.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
    return { ok: true };
  }

  const variant = await db.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) return { ok: false, error: "That item is no longer available." };
  if (quantity > variant.stock) {
    return { ok: false, error: `Only ${variant.stock} left in ${variant.size}.` };
  }

  await db.cartItem.updateMany({
    where: { cartId: cart.id, variantId },
    data: { quantity },
  });
  return { ok: true };
}

export async function removeFromCart(variantId: string): Promise<void> {
  const token = await readCartToken();
  if (!token) return;
  const cart = await db.cart.findUnique({ where: { token } });
  if (!cart) return;
  await db.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
}

export async function clearCart(cartId: string): Promise<void> {
  await db.cartItem.deleteMany({ where: { cartId } });
}

type CartItemRow = {
  id: string;
  variantId: string;
  quantity: number;
  variant: {
    id: string;
    size: string;
    color: string;
    priceMinor: number;
    stock: number;
    product: {
      slug: string;
      name: string;
      sku: string;
      active: boolean;
      images: { id: string; url: string | null }[];
    };
  };
};

async function summarise(cartId: string, items: CartItemRow[]): Promise<CartSummary> {
  const settings = await getSettings();

  const lines: CartLine[] = items
    .filter((item) => item.variant.product.active)
    .map((item) => {
      // Price comes from the database on every read, so a stale client price
      // can never reach the order.
      const unitPriceMinor = item.variant.priceMinor;
      const image = item.variant.product.images[0];
      return {
        id: item.id,
        variantId: item.variantId,
        productSlug: item.variant.product.slug,
        productName: item.variant.product.name,
        sku: item.variant.product.sku,
        size: item.variant.size,
        color: item.variant.color,
        imageUrl: image ? (image.url ?? `/api/images/${image.id}`) : null,
        unitPriceMinor,
        quantity: item.quantity,
        lineTotalMinor: unitPriceMinor * item.quantity,
        availableStock: item.variant.stock,
        exceedsStock: item.quantity > item.variant.stock,
      };
    });

  const subtotalMinor = lines.reduce((sum, l) => sum + l.lineTotalMinor, 0);
  const deliveryFeeMinor = calculateDeliveryFee(subtotalMinor, settings);

  return {
    id: cartId,
    lines,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotalMinor,
    deliveryFeeMinor,
    totalMinor: subtotalMinor + deliveryFeeMinor,
    hasIssues: lines.some((l) => l.exceedsStock),
  };
}
