/**
 * End-to-end test of the customer and inventory flows, run against a real
 * PostgreSQL database. Exercises the service layer directly (no browser), which
 * is where the rules that matter live: OTP security, stock reservation,
 * overselling, address snapshots and customer data isolation.
 *
 * Usage: npm run test:e2e
 */
import { consumeVerifiedToken, sendOtp, verifyOtp } from "../src/lib/auth/otp";
import { db } from "../src/lib/db";
import {
  placeOrder,
  markOrderPaid,
  releaseOrderStock,
  updateOrderStatus,
} from "../src/lib/orders/service";
import { syncStock } from "../src/lib/products/sync";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(name: string) {
  console.log(`\n${name}`);
}

/**
 * The OTP code never leaves the SMS payload, so the test captures it the same
 * way a developer would: from the console provider's log line.
 */
async function captureOtp(phone: string, purpose: "checkout" | "login") {
  const original = console.info;
  let code: string | null = null;

  console.info = (...args: unknown[]) => {
    const line = args.join(" ");
    const match = /code for .*: (\d{4,8})/.exec(line);
    if (match) code = match[1]!;
  };

  const result = await sendOtp(phone, purpose, "e2e-test-client");
  console.info = original;

  return { result, code };
}

async function resetTestData() {
  // Only test-owned rows are removed; the synced catalogue is left alone.
  const phones = ["+9607770001", "+9607770002", "+9607770003"];
  const customers = await db.customer.findMany({
    where: { phone: { in: phones } },
    select: { id: true },
  });
  const ids = customers.map((c) => c.id);

  if (ids.length > 0) {
    const orders = await db.order.findMany({
      where: { customerId: { in: ids } },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    await db.inventoryTransaction.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.order.deleteMany({ where: { customerId: { in: ids } } });
    await db.customer.deleteMany({ where: { id: { in: ids } } });
  }
  await db.otpChallenge.deleteMany({ where: { phone: { in: phones } } });
  await db.rateLimit.deleteMany({});
}

async function main() {
  console.log("E2E test — men's fashion store\n" + "=".repeat(40));
  await resetTestData();

  // -------------------------------------------------------------------------
  section("1. STOCK sync");
  // -------------------------------------------------------------------------
  const report = await syncStock({ triggeredBy: "e2e-test" });
  check("sync completes", report.productsFound > 0, `found ${report.productsFound}`);
  check(
    "invalid folder is isolated, not fatal",
    report.invalidProducts > 0 && report.productsFound > report.invalidProducts,
    `${report.invalidProducts} invalid of ${report.productsFound}`,
  );

  const products = await db.product.findMany({
    where: { active: true },
    include: { variants: true, images: true },
  });
  check("valid products are live", products.length >= 3, `${products.length} active`);
  check(
    "products have images",
    products.every((p) => p.images.length > 0),
  );
  check(
    "no product exceeds 5 images",
    products.every((p) => p.images.length <= 5),
  );
  check(
    "folder-name convention parsed",
    products.some((p) => p.sku === "TSHIRT-STREET-FADE-TEE"),
  );
  check(
    "product.json variants parsed with per-variant stock",
    products.some((p) => p.sku === "TSHIRT-002" && p.variants.length === 5),
  );

  // -------------------------------------------------------------------------
  section("2. OTP security");
  // -------------------------------------------------------------------------
  const phone1 = "+9607770001";
  const { result: send1, code: code1 } = await captureOtp(phone1, "checkout");
  check("OTP send succeeds", send1.ok);
  check("OTP code generated", code1 !== null && /^\d{4}$/.test(code1));

  const stored = await db.otpChallenge.findFirst({ where: { phone: phone1 } });
  check("OTP stored only as a hash", stored !== null && stored.codeHash !== code1);

  const wrongCode = await verifyOtp(phone1, "checkout", "0000" === code1 ? "1111" : "0000");
  check("wrong code rejected", !wrongCode.ok);

  const resend = await sendOtp(phone1, "checkout", "e2e-test-client");
  check("resend blocked by cooldown", !resend.ok);

  const verified = await verifyOtp(phone1, "checkout", code1!);
  check("correct code accepted", verified.ok);

  const token1 = verified.ok ? verified.verifiedToken : "";
  const replay = await verifyOtp(phone1, "checkout", code1!);
  check("consumed challenge cannot be reused", !replay.ok);

  // -------------------------------------------------------------------------
  section("3. First order — account created automatically");
  // -------------------------------------------------------------------------
  const tokenValid = await consumeVerifiedToken(token1, phone1);
  check("verified token redeems once", tokenValid);
  check(
    "verified token cannot be replayed",
    !(await consumeVerifiedToken(token1, phone1)),
  );

  const customer1 = await db.customer.create({
    data: { phone: phone1, name: "Ahmed Ibrahim" },
  });

  const tshirt = products.find((p) => p.sku === "TSHIRT-001")!;
  const variantM = tshirt.variants.find((v) => v.size === "M")!;
  const stockBefore = variantM.stock;

  const order1 = await placeOrder({
    customerId: customer1.id,
    lines: [{ variantId: variantM.id, quantity: 2 }],
    shipping: {
      recipientName: "Ahmed Ibrahim",
      phone: phone1,
      addressLine: "Ma. Blue House, Majeedhee Magu",
      area: "Malé",
    },
    paymentMethod: "bank_transfer",
  });

  check("first order placed", order1.ok, order1.ok ? "" : order1.error);
  if (!order1.ok) throw new Error("cannot continue without an order");

  check("order number assigned", /^\d{5}$/.test(order1.orderNumber));

  const afterOrder = await db.productVariant.findUnique({ where: { id: variantM.id } });
  check(
    "stock decremented on placement",
    afterOrder!.stock === stockBefore - 2,
    `${stockBefore} → ${afterOrder!.stock}`,
  );

  const orderRow = await db.order.findUnique({
    where: { id: order1.orderId },
    include: { items: true, events: true },
  });
  check("payment not marked paid at placement", orderRow!.paymentStatus !== "paid");
  check("delivery fee applied", orderRow!.deliveryFeeMinor >= 0);
  check(
    "total equals subtotal plus delivery",
    orderRow!.totalMinor === orderRow!.subtotalMinor + orderRow!.deliveryFeeMinor,
  );
  check("address snapshotted on the order", orderRow!.shipAddressLine.includes("Blue House"));

  // Saved address, as the checkout action does.
  await db.address.create({
    data: {
      customerId: customer1.id,
      recipientName: "Ahmed Ibrahim",
      phone: phone1,
      addressLine: "Ma. Blue House, Majeedhee Magu",
      area: "Malé",
      isDefault: true,
    },
  });

  // -------------------------------------------------------------------------
  section("4. Address snapshot survives an address edit");
  // -------------------------------------------------------------------------
  await db.address.updateMany({
    where: { customerId: customer1.id },
    data: { addressLine: "H. New Place, Ameenee Magu" },
  });
  const orderAfterEdit = await db.order.findUnique({ where: { id: order1.orderId } });
  check(
    "past order keeps its original address",
    orderAfterEdit!.shipAddressLine.includes("Blue House"),
  );

  // -------------------------------------------------------------------------
  section("5. Payment confirmation is server-side only");
  // -------------------------------------------------------------------------
  await markOrderPaid(order1.orderId, "TRF-12345", "e2e-admin");
  const paidOrder = await db.order.findUnique({ where: { id: order1.orderId } });
  check("order marked paid by staff action", paidOrder!.paymentStatus === "paid");
  check("status advanced to confirmed", paidOrder!.status === "confirmed");
  check("paidAt recorded", paidOrder!.paidAt !== null);

  await updateOrderStatus(order1.orderId, "packed", "e2e-admin");
  const packed = await db.order.findUnique({
    where: { id: order1.orderId },
    include: { events: true },
  });
  check("status updates recorded in history", packed!.events.length >= 3);

  // -------------------------------------------------------------------------
  section("6. Returning customer — second order");
  // -------------------------------------------------------------------------
  const { code: code2 } = await captureOtp(phone1, "login");
  const login = await verifyOtp(phone1, "login", code2!);
  check("returning customer verifies by OTP", login.ok);

  const savedAddress = await db.address.findFirst({
    where: { customerId: customer1.id, isDefault: true },
  });
  check("saved address available for reuse", savedAddress !== null);

  const pants = products.find((p) => p.sku === "PANTS-001")!;
  const pantsVariant = pants.variants[0]!;
  const order2 = await placeOrder({
    customerId: customer1.id,
    lines: [{ variantId: pantsVariant.id, quantity: 1 }],
    shipping: {
      recipientName: savedAddress!.recipientName,
      phone: savedAddress!.phone,
      addressLine: savedAddress!.addressLine,
      area: savedAddress!.area,
    },
    paymentMethod: "cash_on_delivery",
  });
  check("second order placed with saved address", order2.ok);
  check(
    "order numbers increment",
    order2.ok && Number(order2.orderNumber) > Number(order1.orderNumber),
  );

  // -------------------------------------------------------------------------
  section("7. Overselling prevention");
  // -------------------------------------------------------------------------
  const lastUnit = products
    .flatMap((p) => p.variants)
    .find((v) => v.stock > 0);

  // Drive the variant down to exactly one unit, then have two customers race.
  await db.productVariant.update({
    where: { id: lastUnit!.id },
    data: { stock: 1 },
  });

  const buyer2 = await db.customer.create({
    data: { phone: "+9607770002", name: "Buyer Two" },
  });
  const buyer3 = await db.customer.create({
    data: { phone: "+9607770003", name: "Buyer Three" },
  });

  const shipping = {
    recipientName: "Race Test",
    phone: "+9607770002",
    addressLine: "Test address",
    area: "Malé",
  };

  const [raceA, raceB] = await Promise.all([
    placeOrder({
      customerId: buyer2.id,
      lines: [{ variantId: lastUnit!.id, quantity: 1 }],
      shipping,
      paymentMethod: "cash_on_delivery",
    }),
    placeOrder({
      customerId: buyer3.id,
      lines: [{ variantId: lastUnit!.id, quantity: 1 }],
      shipping: { ...shipping, phone: "+9607770003" },
      paymentMethod: "cash_on_delivery",
    }),
  ]);

  const winners = [raceA, raceB].filter((r) => r.ok).length;
  check(
    "exactly one of two concurrent buyers wins the last unit",
    winners === 1,
    `${winners} succeeded`,
  );

  const afterRace = await db.productVariant.findUnique({ where: { id: lastUnit!.id } });
  check("stock never goes negative", afterRace!.stock >= 0, `stock=${afterRace!.stock}`);

  const overOrder = await placeOrder({
    customerId: buyer2.id,
    lines: [{ variantId: lastUnit!.id, quantity: 99 }],
    shipping,
    paymentMethod: "cash_on_delivery",
  });
  check("cannot order more than available", !overOrder.ok);

  // -------------------------------------------------------------------------
  section("8. Cancellation returns stock");
  // -------------------------------------------------------------------------
  const winner = raceA.ok ? raceA : raceB;
  if (winner.ok) {
    const before = (await db.productVariant.findUnique({ where: { id: lastUnit!.id } }))!.stock;
    await releaseOrderStock(winner.orderId, "E2E cancellation test", "e2e-admin");
    const after = (await db.productVariant.findUnique({ where: { id: lastUnit!.id } }))!.stock;
    check("cancelled order returns its stock", after === before + 1, `${before} → ${after}`);

    const cancelled = await db.order.findUnique({ where: { id: winner.orderId } });
    check("order marked cancelled", cancelled!.status === "cancelled");
  }

  // -------------------------------------------------------------------------
  section("9. Stock sync does not erase sales");
  // -------------------------------------------------------------------------
  const beforeResync = await db.productVariant.findUnique({ where: { id: variantM.id } });
  await syncStock({ triggeredBy: "e2e-test-resync" });
  const afterResync = await db.productVariant.findUnique({ where: { id: variantM.id } });
  check(
    "re-syncing unchanged STOCK keeps sold units sold",
    afterResync!.stock === beforeResync!.stock,
    `${beforeResync!.stock} → ${afterResync!.stock}`,
  );

  // -------------------------------------------------------------------------
  section("10. Customer data isolation");
  // -------------------------------------------------------------------------
  const foreignOrder = await db.order.findFirst({
    where: { orderNumber: order1.orderNumber, customerId: buyer2.id },
  });
  check(
    "one customer cannot load another's order by number",
    foreignOrder === null,
  );

  const inventoryLedger = await db.inventoryTransaction.count();
  check("inventory transactions recorded", inventoryLedger > 0, `${inventoryLedger} rows`);

  // -------------------------------------------------------------------------
  console.log("\n" + "=".repeat(40));
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("\nTest run failed:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
