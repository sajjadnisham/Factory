import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getPaymentProvider, type PaymentInstruction } from "@/lib/payments";
import { calculateDeliveryFee, getSettings } from "@/lib/settings";

/**
 * Order placement.
 *
 * The important part is `reserveStock`: stock is decremented inside the same
 * serializable transaction that creates the order, using a conditional update
 * that only succeeds while enough stock remains. Two customers buying the last
 * shirt at the same moment cannot both win — the loser gets an out-of-stock
 * error rather than an oversold order.
 */

export interface OrderLineInput {
  variantId: string;
  quantity: number;
}

export interface ShippingInput {
  recipientName: string;
  phone: string;
  addressLine: string;
  area: string;
  island?: string;
  instructions?: string;
}

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      totalMinor: number;
      payment: PaymentInstruction;
    }
  | { ok: false; error: string; outOfStock?: { variantId: string; available: number }[] };

export async function placeOrder(params: {
  customerId: string;
  lines: OrderLineInput[];
  shipping: ShippingInput;
  paymentMethod: string;
}): Promise<PlaceOrderResult> {
  const { customerId, lines, shipping, paymentMethod } = params;

  if (lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }
  if (lines.some((l) => l.quantity < 1 || l.quantity > 20)) {
    return { ok: false, error: "Invalid quantity — 1 to 20 items per line." };
  }

  const settings = await getSettings();
  const method = settings.paymentMethods.find(
    (m) => m.id === paymentMethod && m.enabled,
  );
  if (!method) {
    return { ok: false, error: "That payment method is not available." };
  }

  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer || !customer.active) {
    return { ok: false, error: "Account not found." };
  }

  let created: { id: string; orderNumber: string; totalMinor: number };

  try {
    created = await db.$transaction(
      async (tx) => {
        const variants = await tx.productVariant.findMany({
          where: { id: { in: lines.map((l) => l.variantId) } },
          include: {
            product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
          },
        });

        const byId = new Map(variants.map((v) => [v.id, v]));
        const shortages: { variantId: string; available: number }[] = [];
        const items: Prisma.OrderItemCreateManyOrderInput[] = [];
        let subtotalMinor = 0;

        for (const line of lines) {
          const variant = byId.get(line.variantId);
          if (!variant || !variant.product.active) {
            throw new OrderError("One of the products is no longer available.");
          }

          // Conditional decrement: the WHERE clause carries the stock check, so
          // the database — not application logic — decides who gets the last unit.
          const updated = await tx.productVariant.updateMany({
            where: { id: variant.id, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });

          if (updated.count === 0) {
            shortages.push({ variantId: variant.id, available: variant.stock });
            continue;
          }

          const lineTotal = variant.priceMinor * line.quantity;
          subtotalMinor += lineTotal;

          items.push({
            variantId: variant.id,
            sku: variant.product.sku,
            productName: variant.product.name,
            size: variant.size,
            color: variant.color,
            imageUrl: variant.product.images[0]
              ? `/api/images/${variant.product.images[0].id}`
              : null,
            unitPriceMinor: variant.priceMinor,
            quantity: line.quantity,
            lineTotalMinor: lineTotal,
          });
        }

        if (shortages.length > 0) {
          throw new OutOfStockError(shortages);
        }

        const deliveryFeeMinor = calculateDeliveryFee(subtotalMinor, settings);
        const totalMinor = subtotalMinor + deliveryFeeMinor;

        const order = await tx.order.create({
          data: {
            orderNumber: await nextOrderNumber(tx),
            customerId,
            // Snapshot, so editing the saved address later never rewrites this
            // order's delivery details.
            shipRecipientName: shipping.recipientName,
            shipPhone: shipping.phone,
            shipAddressLine: shipping.addressLine,
            shipArea: shipping.area,
            shipIsland: shipping.island ?? "",
            shipInstructions: shipping.instructions ?? null,
            subtotalMinor,
            deliveryFeeMinor,
            totalMinor,
            status: "pending",
            paymentStatus: "unpaid",
            items: { createMany: { data: items } },
            events: {
              create: { status: "pending", actor: "customer", note: "Order placed" },
            },
          },
        });

        for (const item of items) {
          const variant = byId.get(item.variantId!)!;
          await tx.inventoryTransaction.create({
            data: {
              variantId: variant.id,
              kind: "reserve",
              quantity: -item.quantity,
              stockAfter: variant.stock - item.quantity,
              orderId: order.id,
              note: `Reserved for ${order.orderNumber}`,
            },
          });
        }

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          totalMinor: order.totalMinor,
        };
      },
      { isolationLevel: "Serializable", timeout: 15_000 },
    );
  } catch (error) {
    if (error instanceof OutOfStockError) {
      return {
        ok: false,
        error: "Some items just sold out. Please review your order.",
        outOfStock: error.shortages,
      };
    }
    if (error instanceof OrderError) {
      return { ok: false, error: error.message };
    }
    // A serialization failure means a concurrent buyer won the race.
    console.error("[orders] placement failed:", error);
    return {
      ok: false,
      error: "We could not complete your order. Please try again.",
    };
  }

  // Payment is initiated only after the order exists, so a gateway callback
  // always has a real order to attach to.
  const provider = getPaymentProvider();
  let instruction: PaymentInstruction;

  try {
    instruction = await provider.initiate(
      {
        orderId: created.id,
        orderNumber: created.orderNumber,
        amountMinor: created.totalMinor,
        currency: "MVR",
        customerPhone: customer.phone,
        customerName: customer.name,
      },
      paymentMethod,
    );
  } catch (error) {
    console.error("[orders] payment initiation failed:", error);
    await releaseOrderStock(created.id, "Payment could not be started");
    return {
      ok: false,
      error: "We could not start the payment. Your items have been released.",
    };
  }

  await db.payment.create({
    data: {
      orderId: created.id,
      provider: provider.name,
      method: paymentMethod,
      amountMinor: created.totalMinor,
      status: instruction.status === "succeeded" ? "succeeded" : "pending",
      providerRef: instruction.reference ?? null,
    },
  });

  await db.order.update({
    where: { id: created.id },
    data: { paymentStatus: "pending" },
  });

  return {
    ok: true,
    orderId: created.id,
    orderNumber: created.orderNumber,
    totalMinor: created.totalMinor,
    payment: instruction,
  };
}

/**
 * Marks an order paid. Only ever called from server-side verification or a
 * signature-checked webhook — never from a browser success screen.
 */
export async function markOrderPaid(
  orderId: string,
  providerRef: string | null,
  actor: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.paymentStatus === "paid") return;

    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "paid",
        status: order.status === "pending" ? "confirmed" : order.status,
        paidAt: new Date(),
      },
    });

    await tx.payment.updateMany({
      where: { orderId, status: { in: ["initiated", "pending"] } },
      data: { status: "succeeded", providerRef: providerRef ?? undefined },
    });

    // Stock was decremented at placement; this records the reservation
    // becoming a sale so the ledger reflects reality.
    for (const item of order.items) {
      if (!item.variantId) continue;
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
      });
      if (!variant) continue;
      await tx.inventoryTransaction.create({
        data: {
          variantId: item.variantId,
          kind: "fulfil",
          quantity: 0,
          stockAfter: variant.stock,
          orderId,
          note: `Payment confirmed for ${order.orderNumber}`,
        },
      });
    }

    await tx.orderEvent.create({
      data: { orderId, status: "confirmed", actor, note: "Payment confirmed" },
    });
  });
}

/** Cancels an order and returns its stock to the shelf. */
export async function releaseOrderStock(
  orderId: string,
  reason: string,
  actor = "system",
): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status === "cancelled") return;

    for (const item of order.items) {
      if (!item.variantId) continue;
      const variant = await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
      await tx.inventoryTransaction.create({
        data: {
          variantId: item.variantId,
          kind: "release",
          quantity: item.quantity,
          stockAfter: variant.stock,
          orderId,
          note: reason,
        },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        paymentStatus: order.paymentStatus === "paid" ? "refunded" : "failed",
      },
    });
    await tx.orderEvent.create({
      data: { orderId, status: "cancelled", actor, note: reason },
    });
  });
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  actor: string,
  note?: string,
): Promise<void> {
  await db.$transaction([
    db.order.update({ where: { id: orderId }, data: { status } }),
    db.orderEvent.create({ data: { orderId, status, actor, note: note ?? null } }),
  ]);
}

class OrderError extends Error {}

class OutOfStockError extends Error {
  constructor(readonly shortages: { variantId: string; available: number }[]) {
    super("Out of stock");
  }
}

/**
 * Human-friendly sequential order numbers (#10245 style), continuing from the
 * highest existing number so restarts never reuse one. Runs inside the
 * placement transaction, and the unique index on orderNumber is the final guard.
 */
async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  // Ordering by the text column would compare lexicographically, where "99999"
  // sorts above "100000" — so the sequence would stall and collide the moment
  // it reached six digits. Cast to a number and take the true maximum.
  const [row] = await tx.$queryRaw<{ max: bigint | null }[]>`
    SELECT MAX(CAST("orderNumber" AS BIGINT)) AS max
    FROM "Order"
    WHERE "orderNumber" ~ '^[0-9]+$'
  `;

  const current = row?.max === null || row?.max === undefined ? 0 : Number(row.max);
  return String(current >= 10_000 ? current + 1 : 10_001);
}
