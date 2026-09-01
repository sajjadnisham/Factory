/**
 * Seeds demo data for development and demos.
 *
 * What it does, in order:
 *   1. generates placeholder images for any STOCK folder missing them,
 *   2. syncs STOCK, so products arrive the same way the store owner creates
 *      them — the folder stays the source of truth even for demo data,
 *   3. creates demo customers, saved addresses and a spread of orders.
 *
 * Orders are placed through the real `placeOrder` service rather than written
 * straight to the tables, so stock, the inventory ledger and order events all
 * end up consistent with what a genuine purchase would produce. Timestamps are
 * backdated afterwards so the dashboard has some history to show.
 *
 * Usage: npm run db:seed
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { hashPassword } from "../src/lib/auth/password";
import { db } from "../src/lib/db";
import {
  markOrderPaid,
  placeOrder,
  releaseOrderStock,
  updateOrderStatus,
} from "../src/lib/orders/service";
import { formatSyncReport, syncStock } from "../src/lib/products/sync";

/**
 * Demo customers live in a reserved number range so re-seeding can remove the
 * previous run's data without touching anyone real.
 */
const DEMO_PHONE_PREFIX = "+96090100";

const DEMO_CUSTOMERS = [
  { phone: `${DEMO_PHONE_PREFIX}01`, name: "Ahmed Rasheed", area: "Malé",
    address: "Ma. Coral View, Boduthakurufaanu Magu", island: "" },
  { phone: `${DEMO_PHONE_PREFIX}02`, name: "Ibrahim Naseer", area: "Hulhumalé",
    address: "Flat 4B, Rehendhi Residence, Lot 11054", island: "" },
  { phone: `${DEMO_PHONE_PREFIX}03`, name: "Hassan Shifau", area: "Malé",
    address: "H. Sunlight, Ameenee Magu", island: "" },
  { phone: `${DEMO_PHONE_PREFIX}04`, name: "Mohamed Zayan", area: "Villimalé",
    address: "G. Fehivinares, Villimalé", island: "" },
  { phone: `${DEMO_PHONE_PREFIX}05`, name: "Ali Mihad", area: "Hulhumalé",
    address: "Flat 12A, Hiyaa Tower 9", island: "" },
  { phone: `${DEMO_PHONE_PREFIX}06`, name: "Yoosuf Areeb", area: "Malé",
    address: "M. Blue Lagoon, Majeedhee Magu", island: "" },
  { phone: `${DEMO_PHONE_PREFIX}07`, name: "Adam Nishan", area: "Malé",
    address: "Ma. Silver Sand, Chaandhanee Magu", island: "" },
  { phone: `${DEMO_PHONE_PREFIX}08`, name: "Shaain Waheed", area: "Hulhumalé",
    address: "Flat 7C, Ocean Front, Lot 10032", island: "" },
];

/**
 * The order book to build. `daysAgo` backdates the order; `status` is applied
 * through the real status-transition service.
 */
const ORDER_PLAN: {
  customer: number;
  daysAgo: number;
  lines: number;
  status: "pending" | "confirmed" | "processing" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
  paid: boolean;
  method: string;
}[] = [
  { customer: 0, daysAgo: 34, lines: 2, status: "delivered", paid: true, method: "bank_transfer" },
  { customer: 1, daysAgo: 31, lines: 1, status: "delivered", paid: true, method: "cash_on_delivery" },
  { customer: 2, daysAgo: 28, lines: 3, status: "delivered", paid: true, method: "bank_transfer" },
  { customer: 0, daysAgo: 25, lines: 1, status: "delivered", paid: true, method: "bank_transfer" },
  { customer: 3, daysAgo: 22, lines: 2, status: "cancelled", paid: false, method: "cash_on_delivery" },
  { customer: 4, daysAgo: 19, lines: 1, status: "delivered", paid: true, method: "cash_on_delivery" },
  { customer: 5, daysAgo: 16, lines: 2, status: "delivered", paid: true, method: "bank_transfer" },
  { customer: 1, daysAgo: 13, lines: 1, status: "delivered", paid: true, method: "bank_transfer" },
  { customer: 6, daysAgo: 10, lines: 2, status: "out_for_delivery", paid: true, method: "bank_transfer" },
  { customer: 2, daysAgo: 8, lines: 1, status: "packed", paid: true, method: "cash_on_delivery" },
  { customer: 7, daysAgo: 6, lines: 3, status: "processing", paid: true, method: "bank_transfer" },
  { customer: 4, daysAgo: 5, lines: 1, status: "processing", paid: true, method: "bank_transfer" },
  { customer: 0, daysAgo: 3, lines: 2, status: "confirmed", paid: true, method: "bank_transfer" },
  { customer: 5, daysAgo: 2, lines: 1, status: "cancelled", paid: false, method: "cash_on_delivery" },
  { customer: 3, daysAgo: 1, lines: 2, status: "pending", paid: false, method: "bank_transfer" },
  { customer: 6, daysAgo: 1, lines: 1, status: "pending", paid: false, method: "cash_on_delivery" },
  { customer: 7, daysAgo: 0, lines: 1, status: "pending", paid: false, method: "bank_transfer" },
];

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  // Spread through the working day rather than all landing at midnight.
  date.setHours(9 + (days % 10), (days * 7) % 60, 0, 0);
  return date;
}

async function removePreviousDemoData(): Promise<void> {
  const customers = await db.customer.findMany({
    where: { phone: { startsWith: DEMO_PHONE_PREFIX } },
    select: { id: true },
  });
  if (customers.length === 0) return;

  const ids = customers.map((c) => c.id);
  const orders = await db.order.findMany({
    where: { customerId: { in: ids } },
    select: { id: true, status: true },
  });

  // Return stock from any demo order that had not already been cancelled, so
  // re-seeding does not quietly drain the shelf each time it runs.
  for (const order of orders) {
    if (order.status !== "cancelled") {
      await releaseOrderStock(order.id, "Demo data reset", "seed");
    }
  }

  await db.inventoryTransaction.deleteMany({
    where: { orderId: { in: orders.map((o) => o.id) } },
  });
  await db.order.deleteMany({ where: { customerId: { in: ids } } });
  await db.customer.deleteMany({ where: { id: { in: ids } } });

  console.log(`  removed ${customers.length} demo customers and ${orders.length} orders`);
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED_IN_PRODUCTION !== "1") {
    throw new Error(
      "Refusing to seed demo customers and orders into a production database.\n" +
      "Set ALLOW_SEED_IN_PRODUCTION=1 only if you are certain this is a demo instance.",
    );
  }

  console.log("Seeding demo data\n" + "=".repeat(40));

  // --- 1. images -----------------------------------------------------------
  console.log("\n1. Placeholder images");
  const images = spawnSync(
    process.execPath,
    [path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"), "scripts/generate-images.ts"],
    { encoding: "utf8" },
  );
  console.log("  " + (images.stdout ?? "").trim().split("\n").join("\n  "));
  if (images.status !== 0) {
    console.warn("  ! image generation failed; products may render without pictures");
  }

  // --- 2. catalogue --------------------------------------------------------
  console.log("\n2. STOCK sync");
  const report = await syncStock({ triggeredBy: "seed" });
  console.log("  " + formatSyncReport(report).split("\n").join("\n  "));
  if (report.issues.length > 0) {
    console.log(`  (${report.issues.length} issue(s) recorded — BROKEN-001 is intentional)`);
  }

  const variants = await db.productVariant.findMany({
    where: { product: { active: true }, stock: { gt: 2 } },
    include: { product: { select: { name: true } } },
    orderBy: { id: "asc" },
  });

  if (variants.length === 0) {
    throw new Error("No sellable variants after sync — cannot create demo orders.");
  }

  // --- 3. admin ------------------------------------------------------------
  console.log("\n3. Admin user");
  const adminUsername = process.env.ADMIN_INITIAL_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (adminUsername && adminPassword && adminPassword.length >= 12) {
    await db.adminUser.upsert({
      where: { username: adminUsername },
      create: { username: adminUsername, passwordHash: await hashPassword(adminPassword), role: "admin" },
      update: { active: true },
    });
    console.log(`  ready: ${adminUsername}`);
  } else {
    const existing = await db.adminUser.count();
    console.log(
      existing > 0
        ? `  ${existing} admin user(s) already exist — left alone`
        : "  skipped (set ADMIN_INITIAL_USERNAME and ADMIN_INITIAL_PASSWORD to create one)",
    );
  }

  // --- 4. customers --------------------------------------------------------
  console.log("\n4. Demo customers and orders");
  await removePreviousDemoData();

  const customers = [];
  for (const demo of DEMO_CUSTOMERS) {
    const customer = await db.customer.create({
      data: {
        phone: demo.phone,
        name: demo.name,
        addresses: {
          create: {
            label: "Home",
            recipientName: demo.name,
            phone: demo.phone,
            addressLine: demo.address,
            area: demo.area,
            island: demo.island,
            isDefault: true,
          },
        },
      },
    });
    customers.push({ ...demo, id: customer.id });
  }
  console.log(`  created ${customers.length} customers with saved addresses`);

  // --- 5. orders -----------------------------------------------------------
  let placed = 0;
  let skipped = 0;
  let cursor = 0;

  for (const plan of ORDER_PLAN) {
    const customer = customers[plan.customer]!;

    // Walk the variant list so orders spread across the catalogue instead of
    // hammering one product.
    const lines: { variantId: string; quantity: number }[] = [];
    for (let i = 0; i < plan.lines; i += 1) {
      const variant = variants[cursor % variants.length]!;
      cursor += 1;
      if (lines.some((l) => l.variantId === variant.id)) continue;
      lines.push({ variantId: variant.id, quantity: 1 + (cursor % 2) });
    }

    const result = await placeOrder({
      customerId: customer.id,
      lines,
      shipping: {
        recipientName: customer.name,
        phone: customer.phone,
        addressLine: customer.address,
        area: customer.area,
        island: customer.island,
      },
      paymentMethod: plan.method,
    });

    if (!result.ok) {
      // Running low on a variant is expected once the plan is large; skip that
      // order rather than aborting the whole seed.
      skipped += 1;
      continue;
    }

    const when = daysAgo(plan.daysAgo);

    if (plan.paid) {
      await markOrderPaid(result.orderId, `DEMO-${result.orderNumber}`, "seed");
    }
    if (plan.status === "cancelled") {
      await releaseOrderStock(result.orderId, "Customer changed their mind", "seed");
    } else if (plan.status !== "pending") {
      await updateOrderStatus(result.orderId, plan.status, "seed");
    }

    // Backdate the order and everything hanging off it, so the dashboard shows
    // history rather than seventeen orders placed in the same second.
    await db.order.update({
      where: { id: result.orderId },
      data: {
        placedAt: when,
        createdAt: when,
        ...(plan.paid ? { paidAt: when } : {}),
        ...(plan.status === "cancelled" ? { cancelledAt: when } : {}),
      },
    });
    await db.orderEvent.updateMany({
      where: { orderId: result.orderId },
      data: { createdAt: when },
    });
    await db.inventoryTransaction.updateMany({
      where: { orderId: result.orderId },
      data: { createdAt: when },
    });

    placed += 1;
  }

  console.log(`  placed ${placed} orders${skipped > 0 ? `, skipped ${skipped} (insufficient stock)` : ""}`);

  // --- summary -------------------------------------------------------------
  const [productCount, customerCount, orderCount, paidTotal] = await Promise.all([
    db.product.count({ where: { active: true } }),
    db.customer.count(),
    db.order.count(),
    db.order.aggregate({ _sum: { totalMinor: true }, where: { paymentStatus: "paid" } }),
  ]);

  console.log("\n" + "=".repeat(40));
  console.log(`Products:  ${productCount} live`);
  console.log(`Customers: ${customerCount}`);
  console.log(`Orders:    ${orderCount}`);
  console.log(`Paid:      MVR ${((paidTotal._sum.totalMinor ?? 0) / 100).toLocaleString("en-US")}`);
  console.log("\nDemo customers use numbers starting " + DEMO_PHONE_PREFIX + ".");
  console.log("Run `npm run dev` and open http://localhost:3000");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
